import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Progress, message, Button, Space } from 'antd';
import {
  ArrowLeftOutlined,
  TeamOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  BarChartOutlined,
  ExclamationCircleOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import api from '../utils/api';

function Dashboard() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDashboard();
  }, [assignmentId]);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/stats/assignment/${assignmentId}/dashboard`);
      setData(response.data);
    } catch (error) {
      message.error('获取统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    window.open(`/api/stats/assignment/${assignmentId}/export`, '_blank');
  };

  const scoreDistributionData = data?.scores?.distribution
    ? Object.entries(data.scores.distribution).map(([range, count]) => ({
        name: range,
        value: count,
      }))
    : [];

  const COLORS = ['#52c41a', '#1890ff', '#faad14', '#fa8c16', '#f5222d'];

  const submissionPieData = data?.submissions
    ? [
        { name: '已提交', value: data.submissions.submitted },
        { name: '迟交', value: data.submissions.late },
        { name: '未提交', value: data.submissions.notSubmitted },
      ]
    : [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(`/assignments/${assignmentId}`)}
            style={{ marginBottom: 16 }}
          >
            返回作业
          </Button>
          <h2 style={{ margin: 0 }}>
            <BarChartOutlined style={{ marginRight: 8 }} />
            {data?.assignment?.title || '统计看板'}
          </h2>
        </div>
        <Button icon={<DownloadOutlined />} type="primary" onClick={handleExport}>
          导出成绩
        </Button>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="学生总数"
              value={data?.submissions?.totalStudents || 0}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="已提交"
              value={data?.submissions?.submitted || 0}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="迟交"
              value={data?.submissions?.late || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="已出分"
              value={data?.submissions?.graded || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12} lg={8}>
          <Card title="成绩统计">
            <Row gutter={16}>
              <Col span={8}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>
                    {data?.scores?.average?.toFixed(1) || '-'}
                  </div>
                  <div style={{ color: '#999', fontSize: 12 }}>平均分</div>
                </div>
              </Col>
              <Col span={8}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>
                    {data?.scores?.max || '-'}
                  </div>
                  <div style={{ color: '#999', fontSize: 12 }}>最高分</div>
                </div>
              </Col>
              <Col span={8}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#f5222d' }}>
                    {data?.scores?.min || '-'}
                  </div>
                  <div style={{ color: '#999', fontSize: 12 }}>最低分</div>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Card title="互评完成情况">
            <div style={{ textAlign: 'center' }}>
              <Progress
                type="dashboard"
                percent={data?.reviews?.completionRate || 0}
                format={(percent) => `${percent}%`}
              />
              <div style={{ marginTop: 12 }}>
                已完成 {data?.reviews?.completed || 0} / {data?.reviews?.totalAssigned || 0} 份
              </div>
              {data?.reviews?.pending !== undefined && data.reviews.pending > 0 && (
                <div style={{ color: '#faad14', fontSize: 12, marginTop: 4 }}>
                  还有 {data.reviews.pending} 份待完成
                </div>
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Card title="申诉情况">
            <Row gutter={16}>
              <Col span={12}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 'bold' }}>
                    {data?.appeals?.total || 0}
                  </div>
                  <div style={{ color: '#999', fontSize: 12 }}>总申诉</div>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 'bold', color: '#faad14' }}>
                    {data?.appeals?.pending || 0}
                  </div>
                  <div style={{ color: '#999', fontSize: 12 }}>待处理</div>
                </div>
              </Col>
            </Row>
            <Row gutter={16} style={{ marginTop: 12 }}>
              <Col span={12}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 'bold', color: '#52c41a' }}>
                    {data?.appeals?.resolved || 0}
                  </div>
                  <div style={{ color: '#999', fontSize: 12 }}>已解决</div>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 'bold', color: '#999' }}>
                    {data?.appeals?.rejected || 0}
                  </div>
                  <div style={{ color: '#999', fontSize: 12 }}>已驳回</div>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <Card title="分数分布">
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scoreDistributionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#1890ff" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title="提交情况">
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={submissionPieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {submissionPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default Dashboard;
