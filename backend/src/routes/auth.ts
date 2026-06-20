import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../prisma';
import { generateToken, authMiddleware, UserRole, UserRoleValues } from '../middleware/auth';
import { auditLog } from '../middleware/audit';

const router = Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const token = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role as UserRole,
    });

    await auditLog(req, 'LOGIN', 'User', user.id);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        studentId: user.studentId,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '登录失败' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { username, email, password, name, role, studentId } = req.body;

    if (!username || !email || !password || !name) {
      return res.status(400).json({ error: '请填写所有必填项' });
    }

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ username }, { email }] },
    });

    if (existingUser) {
      return res.status(400).json({ error: '用户名或邮箱已存在' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const userRole = (role && Object.values(UserRoleValues).includes(role as UserRole))
      ? role as UserRole
      : UserRoleValues.STUDENT;

    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        name,
        role: userRole,
        studentId: studentId || null,
      },
    });

    const token = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role as UserRole,
    });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        studentId: user.studentId,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '注册失败' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        studentId: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

export default router;
