import { Router } from 'express';
import prisma from '../prisma';
import { authMiddleware, requireRoles, UserRole } from '../middleware/auth';
import { auditMiddleware } from '../middleware/audit';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    const courseMembers = await prisma.courseMember.findMany({
      where: { userId },
      include: {
        course: {
          include: {
            teacher: {
              select: { id: true, name: true, email: true },
            },
            _count: {
              select: {
                members: true,
                assignments: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const courses = courseMembers.map((cm) => ({
      ...cm.course,
      role: cm.role,
      memberCount: cm.course._count.members,
      assignmentCount: cm.course._count.assignments,
    }));

    res.json(courses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取课程列表失败' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const membership = await prisma.courseMember.findFirst({
      where: { courseId: id, userId },
    });

    if (!membership) {
      return res.status(403).json({ error: '无权访问此课程' });
    }

    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        teacher: {
          select: { id: true, name: true, email: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, studentId: true, role: true },
            },
          },
          orderBy: { role: 'asc' },
        },
        assignments: {
          orderBy: { createdAt: 'desc' },
        },
        groups: {
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, name: true, studentId: true },
                },
              },
            },
          },
        },
      },
    });

    if (!course) {
      return res.status(404).json({ error: '课程不存在' });
    }

    res.json({
      ...course,
      userRole: membership.role,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取课程详情失败' });
  }
});

router.post('/', requireRoles('TEACHER'), async (req, res) => {
  try {
    const { name, code, description } = req.body;
    const teacherId = req.user!.userId;

    if (!name || !code) {
      return res.status(400).json({ error: '课程名称和代码不能为空' });
    }

    const existingCourse = await prisma.course.findUnique({ where: { code } });
    if (existingCourse) {
      return res.status(400).json({ error: '课程代码已存在' });
    }

    const course = await prisma.course.create({
      data: {
        name,
        code,
        description: description || null,
        teacherId,
        members: {
          create: {
            userId: teacherId,
            role: 'TEACHER',
          },
        },
      },
      include: {
        teacher: { select: { id: true, name: true, email: true } },
      },
    });

    await auditMiddleware('CREATE', 'Course')(req, res, () => {});

    res.status(201).json(course);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '创建课程失败' });
  }
});

router.post('/:id/enroll', requireRoles('STUDENT'), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) {
      return res.status(404).json({ error: '课程不存在' });
    }

    const existing = await prisma.courseMember.findFirst({
      where: { courseId: id, userId },
    });

    if (existing) {
      return res.status(400).json({ error: '已经选了这门课' });
    }

    const member = await prisma.courseMember.create({
      data: {
        courseId: id,
        userId,
        role: 'STUDENT',
      },
    });

    res.status(201).json(member);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '选课失败' });
  }
});

router.post('/:id/members', requireRoles('TEACHER', 'TA'), async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, role } = req.body;

    if (!userId || !role) {
      return res.status(400).json({ error: '用户ID和角色不能为空' });
    }

    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) {
      return res.status(404).json({ error: '课程不存在' });
    }

    const existing = await prisma.courseMember.findFirst({
      where: { courseId: id, userId },
    });

    if (existing) {
      return res.status(400).json({ error: '该用户已在课程中' });
    }

    const member = await prisma.courseMember.create({
      data: {
        courseId: id,
        userId,
        role: role as UserRole,
      },
      include: {
        user: { select: { id: true, name: true, email: true, studentId: true } },
      },
    });

    res.status(201).json(member);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '添加成员失败' });
  }
});

router.delete('/:id/members/:userId', requireRoles('TEACHER'), async (req, res) => {
  try {
    const { id, userId } = req.params;

    const member = await prisma.courseMember.findFirst({
      where: { courseId: id, userId },
    });

    if (!member) {
      return res.status(404).json({ error: '成员不存在' });
    }

    await prisma.courseMember.delete({ where: { id: member.id } });

    res.json({ message: '已移除成员' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '移除成员失败' });
  }
});

router.post('/:id/groups', requireRoles('TEACHER', 'TA'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, studentIds } = req.body;

    if (!name) {
      return res.status(400).json({ error: '小组名称不能为空' });
    }

    const group = await prisma.group.create({
      data: {
        courseId: id,
        name,
        members: studentIds
          ? {
              create: studentIds.map((userId: string) => ({ userId })),
            }
          : undefined,
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, studentId: true } },
          },
        },
      },
    });

    res.status(201).json(group);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '创建小组失败' });
  }
});

router.get('/:id/students', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const membership = await prisma.courseMember.findFirst({
      where: { courseId: id, userId },
    });

    if (!membership) {
      return res.status(403).json({ error: '无权访问' });
    }

    const students = await prisma.courseMember.findMany({
      where: {
        courseId: id,
        role: 'STUDENT',
      },
      include: {
        user: {
          select: { id: true, name: true, studentId: true, email: true },
        },
      },
    });

    res.json(students);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取学生列表失败' });
  }
});

export default router;
