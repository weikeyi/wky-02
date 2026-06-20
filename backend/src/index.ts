import express from 'express';
import cors from 'cors';
import path from 'path';

import authRouter from './routes/auth';
import coursesRouter from './routes/courses';
import assignmentsRouter from './routes/assignments';
import submissionsRouter from './routes/submissions';
import reviewsRouter from './routes/reviews';
import appealsRouter from './routes/appeals';
import statsRouter from './routes/stats';
import auditRouter from './routes/audit';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/courses', coursesRouter);
app.use('/api/assignments', assignmentsRouter);
app.use('/api/submissions', submissionsRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/appeals', appealsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/audit', auditRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
  console.log(`API 地址: http://localhost:${PORT}/api`);
});

export default app;
