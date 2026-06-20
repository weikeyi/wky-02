"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('开始播种示例数据...');
    const hashedPassword = await bcryptjs_1.default.hash('password123', 10);
    const teacher = await prisma.user.upsert({
        where: { username: 'teacher1' },
        update: {},
        create: {
            username: 'teacher1',
            email: 'teacher1@example.com',
            password: hashedPassword,
            name: '张老师',
            role: 'TEACHER',
        },
    });
    const ta1 = await prisma.user.upsert({
        where: { username: 'ta1' },
        update: {},
        create: {
            username: 'ta1',
            email: 'ta1@example.com',
            password: hashedPassword,
            name: '李助教',
            role: 'TA',
        },
    });
    const students = [];
    for (let i = 1; i <= 20; i++) {
        const student = await prisma.user.upsert({
            where: { username: `student${i}` },
            update: {},
            create: {
                username: `student${i}`,
                email: `student${i}@example.com`,
                password: hashedPassword,
                name: `学生${i}`,
                role: 'STUDENT',
                studentId: `S202400${i.toString().padStart(3, '0')}`,
            },
        });
        students.push(student);
    }
    const course = await prisma.course.upsert({
        where: { code: 'CS101' },
        update: {},
        create: {
            name: '软件工程基础',
            code: 'CS101',
            description: '学习软件工程的基本概念、方法和实践',
            teacherId: teacher.id,
        },
    });
    await prisma.courseMember.upsert({
        where: { courseId_userId: { courseId: course.id, userId: teacher.id } },
        update: {},
        create: {
            courseId: course.id,
            userId: teacher.id,
            role: 'TEACHER',
        },
    });
    await prisma.courseMember.upsert({
        where: { courseId_userId: { courseId: course.id, userId: ta1.id } },
        update: {},
        create: {
            courseId: course.id,
            userId: ta1.id,
            role: 'TA',
        },
    });
    for (const student of students) {
        await prisma.courseMember.upsert({
            where: { courseId_userId: { courseId: course.id, userId: student.id } },
            update: {},
            create: {
                courseId: course.id,
                userId: student.id,
                role: 'STUDENT',
            },
        });
    }
    const group1 = await prisma.group.upsert({
        where: { courseId_name: { courseId: course.id, name: '第一组' } },
        update: {},
        create: {
            courseId: course.id,
            name: '第一组',
        },
    });
    const group2 = await prisma.group.upsert({
        where: { courseId_name: { courseId: course.id, name: '第二组' } },
        update: {},
        create: {
            courseId: course.id,
            name: '第二组',
        },
    });
    const group3 = await prisma.group.upsert({
        where: { courseId_name: { courseId: course.id, name: '第三组' } },
        update: {},
        create: {
            courseId: course.id,
            name: '第三组',
        },
    });
    const group4 = await prisma.group.upsert({
        where: { courseId_name: { courseId: course.id, name: '第四组' } },
        update: {},
        create: {
            courseId: course.id,
            name: '第四组',
        },
    });
    for (let i = 0; i < 5; i++) {
        await prisma.groupMember.upsert({
            where: { groupId_userId: { groupId: group1.id, userId: students[i].id } },
            update: {},
            create: { groupId: group1.id, userId: students[i].id },
        });
    }
    for (let i = 5; i < 10; i++) {
        await prisma.groupMember.upsert({
            where: { groupId_userId: { groupId: group2.id, userId: students[i].id } },
            update: {},
            create: { groupId: group2.id, userId: students[i].id },
        });
    }
    for (let i = 10; i < 15; i++) {
        await prisma.groupMember.upsert({
            where: { groupId_userId: { groupId: group3.id, userId: students[i].id } },
            update: {},
            create: { groupId: group3.id, userId: students[i].id },
        });
    }
    for (let i = 15; i < 20; i++) {
        await prisma.groupMember.upsert({
            where: { groupId_userId: { groupId: group4.id, userId: students[i].id } },
            update: {},
            create: { groupId: group4.id, userId: students[i].id },
        });
    }
    const now = new Date();
    const submissionDeadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const reviewDeadline = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const assignment1 = await prisma.assignment.upsert({
        where: { id: 'assignment-1' },
        update: {},
        create: {
            id: 'assignment-1',
            courseId: course.id,
            title: '第一次作业：需求分析报告',
            description: '请撰写一份软件需求分析报告，包含功能需求、非功能需求、用户故事等内容。',
            status: 'SUBMISSION',
            submissionDeadline,
            reviewDeadline,
            reviewsPerSubmission: 3,
            anonymousReview: true,
            dropHighestLowest: true,
            lateDeductionType: 'PER_DAY',
            lateDeductionValue: 5,
            lateDeductionMax: 30,
            incompleteReviewPenalty: 5,
            maxScore: 100,
            rubric: {
                create: [
                    { name: '完整性', description: '需求描述的完整程度', maxScore: 30, weight: 1, order: 0 },
                    { name: '清晰性', description: '需求描述是否清晰易懂', maxScore: 25, weight: 1, order: 1 },
                    { name: '可行性', description: '需求实现的技术可行性', maxScore: 25, weight: 1, order: 2 },
                    { name: '文档质量', description: '文档结构和文字表达', maxScore: 20, weight: 1, order: 3 },
                ],
            },
        },
    });
    const assignment2 = await prisma.assignment.upsert({
        where: { id: 'assignment-2' },
        update: {},
        create: {
            id: 'assignment-2',
            courseId: course.id,
            title: '第二次作业：系统设计',
            description: '基于需求分析，完成系统架构设计和详细设计。',
            status: 'DRAFT',
            submissionDeadline: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000),
            reviewDeadline: new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000),
            reviewsPerSubmission: 3,
            anonymousReview: true,
            dropHighestLowest: true,
            lateDeductionType: 'NONE',
            incompleteReviewPenalty: 5,
            maxScore: 100,
            rubric: {
                create: [
                    { name: '架构设计', description: '系统架构的合理性', maxScore: 35, weight: 1, order: 0 },
                    { name: '模块设计', description: '模块划分的合理性', maxScore: 35, weight: 1, order: 1 },
                    { name: '文档质量', description: '设计文档质量', maxScore: 30, weight: 1, order: 2 },
                ],
            },
        },
    });
    for (let i = 0; i < 15; i++) {
        const student = students[i];
        await prisma.submission.upsert({
            where: {
                assignmentId_studentId: {
                    assignmentId: assignment1.id,
                    studentId: student.id,
                },
            },
            update: {},
            create: {
                assignmentId: assignment1.id,
                studentId: student.id,
                content: `# 需求分析报告 - 学生${i + 1}\n\n## 1. 引言\n这是学生${i + 1}的需求分析报告...\n\n## 2. 功能需求\n- 功能1：用户登录\n- 功能2：数据管理\n- 功能3：报表生成\n\n## 3. 非功能需求\n- 性能：响应时间 < 2秒\n- 可用性：99.9% uptime\n\n## 4. 用户故事\n作为一个用户，我希望...`,
                attachmentUrl: `https://example.com/submissions/student${i + 1}.pdf`,
                status: 'SUBMITTED',
                submittedAt: new Date(now.getTime() - Math.random() * 2 * 24 * 60 * 60 * 1000),
            },
        });
    }
    console.log('示例数据播种完成！');
    console.log('');
    console.log('测试账号：');
    console.log('  教师: teacher1 / password123');
    console.log('  助教: ta1 / password123');
    console.log('  学生: student1 ~ student20 / password123');
    console.log('');
    console.log(`课程: ${course.name} (${course.code})`);
    console.log(`作业: ${assignment1.title}`);
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
