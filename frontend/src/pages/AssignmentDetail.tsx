import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Space,
  Descriptions,
  Tag,
  Form,
  Input,
  message,
  Table,
  Modal,
  Rate,
  Divider,
  Statistic,
  Row,
  Col,
} from 'antd';
import {
  ArrowLeftOutlined,
  FileTextOutlined,
  UploadOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  BarChartOutlined,
  DownloadOutlined,
  PlayCircleOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../utils/api';
import { Assignment, Submission, Review } from '../types';
import { useAuth } from '../contexts/AuthContext';

const { TextArea } = Input;

function AssignmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitModalVisible, setSubmitModalVisible] = useState(false);
  const [appealModalVisible, setAppealModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [appealForm] = Form.useForm();

  useEffect(() => {
    fetchAssignment();
  }, [id]);

  const fetchAssignment = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/assignments/${id}`);
      setAssignment(response.data);

      if (response.data.userSubmission) {
        setSubmission(response.data.userSubmission);
        fetchReviews(response.data.userSubmission.id);
      }

      if (user?.role === 'TEACHER' || user?.role === 'TA') {
        fetchAllSubmissions();
      }
    } catch (error) {
      message.error('获取作业详情失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllSubmissions = async () => {
    try {
      const response = await api.get(`/submissions/assignment/${id}/all`);
      setSubmissions(response.data);
    } catch (error) {
      console.error('获取提交列表失败');
    }
  };

  const fetchReviews = async (submissionId: string) => {
    try {
      const response = await api.get(`/reviews/submission/${submissionId}`);
      setReviews(response.data);
    } catch (error) {
      console.error('获取互评失败');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      await api.post(`/submissions/assignment/${id}`, values);
      message.success('提交成功');
      setSubmitModalVisible(false);
      form.resetFields();
      fetchAssignment();
    } catch (error: any) {
      message.error(error.response?.data?.error || '提交失败');
    }
  };

  const handleAppeal = async (values: any) => {
    try {
      await api.post(`/appeals/submission/${submission!.id}`, values);
      message.success('申诉已提交');
      setAppealModalVisible(false);
      appealForm.resetFields();
      fetchAssignment();
    } catch (error: any) {
      message.error(error.response?.data?.error || '申诉失败');
    }
  };

  const handlePublish = async () => {
    try {
      await api.post(`/assignments/${id}/publish`);
      message.success('发布成功');
      fetchAssignment();
    } catch (error: any) {
      message.error(error.response?.data?.error || '发布失败');
    }
  };

  const handleAllocate = async () => {
    try {
      await api.post(`/assignments/${id}/allocate-reviews`);
      message.success('互评分配完成');
      fetchAssignment();
    } catch (error: any) {
      message.error(error.response?.data?.error || '分配失败');
    }
  };

  const handleCalculate = async () => {
    try {
      await api.post(`/submissions/assignment/${id}/calculate-all`);
      message.success('分数计算完成');
      fetchAssignment();
      fetchAllSubmissions();
    } catch (error: any) {
      message.error(error.response?.data?.error || '计算失败');
    }
  };

  const handleExport = () => {
    window.open(`/api/stats/assignment/${id}/export`, '_blank');
  };

  const handleReopen = async () => {
    Modal.confirm({
      title: '重新开放作业',
      content: '确定要重新开放此作业吗？学生可以重新提交。',
      onOk: async () => {
        try {
          await api.post(`/assignments/${id}/reopen`);
          message.success('作业已重新开放');
          fetchAssignment();
        } catch (error: any) {
          message.error(error.response?.data?.error || '操作失败');
        }
      },
    });
  };

  const statusTagColor: Record<string, string> = {
    DRAFT: 'default',
    SUBMISSION: 'processing',
    PEER_REVIEW: 'blue',
    GRADING: 'orange',
    COMPLETED: 'success',
    REOPENED: 'warning',
  };

  const statusText: Record<string, string> = {
    DRAFT: '草稿',
    SUBMISSION: '提交中',
    PEER_REVIEW: '互评中',
    GRADING: '评分中',
    COMPLETED: '已完成',
    REOPENED: '已重开',
  };

  const isStaff = user?.role === 'TEACHER' || user?.role === 'TA';
  const isTeacher = user?.role === 'TEACHER';
  const isStudent = user?.role === 'STUDENT';

  const submissionStatusText: Record<string, string> = {
    NOT_SUBMITTED: '未提交',
    SUBMITTED: '已提交',
    LATE: '迟交',
    NOT_SUBMITTED_LATE: '逾期未交',
  };

  const submissionStatusColor: Record<string, string> = {
    NOT_SUBMITTED: 'default',
    SUBMITTED: 'success',
    LATE: 'warning',
    NOT_SUBMITTED_LATE: 'error',
  };

  return (
    <div>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(`/courses/${assignment?.courseId}`)}
        style={{ marginBottom: 16 }}
      >
        返回课程
      </Button>

      <Card loading={loading} title={
        <Space>
          <FileTextOutlined />
          {assignment?.title}
          <Tag color={statusTagColor[assignment?.currentStatus || 'DRAFT']}>
            {statusText[assignment?.currentStatus || 'DRAFT']}
          </Tag>
        </Space>
      } extra={
        <Space>
          {isStudent && (
            <>
              {assignment?.currentStatus === 'SUBMISSION' && (
                <Button
                  type="primary"
                  icon={submission ? <EditOutlined /> : <UploadOutlined />}
                  onClick={() => {
                    if (submission) {
                      form.setFieldsValue({
                        content: submission.content,
                        attachmentUrl: submission.attachmentUrl,
                      });
                    }
                    setSubmitModalVisible(true);
                  }}
                >
                  {submission ? '修改提交' : '提交作业'}
                </Button>
              )}
              {assignment?.currentStatus === 'PEER_REVIEW' && (
                <Button
                  type="primary"
                  onClick={() => navigate(`/reviews/${id}`)}
                >
                  去互评
                </Button>
              )}
            </>
          )}
          {isStaff && (
            <>
              {assignment?.status === 'DRAFT' && isTeacher && (
                <Button type="primary" icon={<PlayCircleOutlined />} onClick={handlePublish}>
                  发布
                </Button>
              )}
              {assignment?.currentStatus === 'PEER_REVIEW' && (
                <Button icon={<CheckCircleOutlined />} onClick={handleAllocate}>
                  分配互评
                </Button>
              )}
              {isTeacher && (
                <Button icon={<BarChartOutlined />} onClick={handleCalculate}>
                  计算分数
                </Button>
              )}
              {isTeacher && assignment?.currentStatus === 'COMPLETED' && (
                <Button icon={<DownloadOutlined />} onClick={handleExport}>
                  导出成绩
                </Button>
              )}
              {isTeacher && (
                <Button icon={<UnlockOutlined />} onClick={handleReopen}>
                  重新开放
                </Button>
              )}
              {isTeacher && (
                <Button onClick={() => navigate(`/dashboard/${id}`)}>
                  统计看板
                </Button>
              )}
            </>
          )}
        </Space>
      }>
        <Descriptions column={2}>
          <Descriptions.Item label="提交截止">
            {dayjs(assignment?.submissionDeadline).format('YYYY-MM-DD HH:mm')}
          </Descriptions.Item>
          <Descriptions.Item label="互评截止">
            {dayjs(assignment?.reviewDeadline).format('YYYY-MM-DD HH:mm')}
          </Descriptions.Item>
          <Descriptions.Item label="每份评审人数">
            {assignment?.reviewsPerSubmission} 人
          </Descriptions.Item>
          <Descriptions.Item label="满分">
            {assignment?.maxScore} 分
          </Descriptions.Item>
          <Descriptions.Item label="匿名互评">
            {assignment?.anonymousReview ? '是' : '否'}
          </Descriptions.Item>
          <Descriptions.Item label="去最高最低分">
            {assignment?.dropHighestLowest ? '是' : '否'}
          </Descriptions.Item>
        </Descriptions>

        {assignment?.description && (
          <>
            <Divider />
            <div>
              <h4>作业描述</h4>
              <p style={{ whiteSpace: 'pre-wrap' }}>{assignment.description}</p>
            </div>
          </>
        )}

        {assignment?.rubric && assignment.rubric.length > 0 && (
          <>
            <Divider />
            <div>
              <h4>评分标准</h4>
              <Table
                size="small"
                dataSource={assignment.rubric}
                rowKey="id"
                pagination={false}
                columns={[
                  { title: '评分项', dataIndex: 'name', key: 'name' },
                  { title: '描述', dataIndex: 'description', key: 'description' },
                  { title: '满分', dataIndex: 'maxScore', key: 'maxScore', width: 80 },
                  { title: '权重', dataIndex: 'weight', key: 'weight', width: 80 },
                ]}
              />
            </div>
          </>
        )}
      </Card>

      {isStudent && submission && (
        <Card
          style={{ marginTop: 16 }}
          title="我的提交"
          extra={
            <Tag color={submissionStatusColor[submission.status]}>
              {submissionStatusText[submission.status]}
            </Tag>
          }
        >
          <Row gutter={16}>
            <Col span={8}>
              <Statistic
                title="最终得分"
                value={submission.finalScore ?? '-'}
                suffix="分"
                valueStyle={{ color: submission.finalScore !== undefined ? '#3f8600' : undefined }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="原始分"
                value={submission.rawScore ?? '-'}
                suffix="分"
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="评审数"
                value={reviews.length}
                suffix="份"
              />
            </Col>
          </Row>

          {submission.submittedAt && (
            <div style={{ marginTop: 16, color: '#666' }}>
              提交时间: {dayjs(submission.submittedAt).format('YYYY-MM-DD HH:mm')}
              {submission.status === 'LATE' && (
                <Tag color="warning" style={{ marginLeft: 8 }}>
                  迟交 {Math.round(submission.lateMinutes / 60)} 小时
                </Tag>
              )}
            </div>
          )}

          {submission.content && (
            <>
              <Divider />
              <h4>提交内容</h4>
              <div style={{ whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
                {submission.content}
              </div>
            </>
          )}

          {reviews.length > 0 && (
            <>
              <Divider />
              <h4>互评结果</h4>
              {reviews.map((review, index) => (
                <Card
                  key={review.id}
                  size="small"
                  style={{ marginTop: 8 }}
                  title={`评审 ${index + 1} - ${review.reviewer?.name || '匿名'}`}
                >
                  <p><strong>总分:</strong> {review.overallScore} 分</p>
                  {review.overallComment && (
                    <p><strong>评语:</strong> {review.overallComment}</p>
                  )}
                  {review.criterionScores && review.criterionScores.length > 0 && (
                    <div>
                      <p><strong>分项得分:</strong></p>
                      <ul>
                        {review.criterionScores.map((cs) => (
                          <li key={cs.id}>
                            {assignment?.rubric?.find(r => r.id === cs.criterionId)?.name}: {cs.score} 分
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Card>
              ))}
            </>
          )}

          {submission.finalScore !== null && submission.finalScore !== undefined && (
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              {submission.appeal ? (
                <Tag color={submission.appeal.status === 'PENDING' ? 'processing' : 'blue'}>
                  {submission.appeal.status === 'PENDING' ? '申诉处理中' : '申诉已处理'}
                </Tag>
              ) : (
                <Button
                  icon={<ExclamationCircleOutlined />}
                  onClick={() => setAppealModalVisible(true)}
                  type="primary"
                  danger
                >
                  发起申诉
                </Button>
              )}
            </div>
          )}
        </Card>
      )}

      {isStaff && (
        <Card style={{ marginTop: 16 }} title="所有提交">
          <Table
            dataSource={submissions}
            rowKey="id"
            size="small"
            columns={[
              {
                title: '学号',
                dataIndex: ['student', 'studentId'],
                key: 'studentId',
              },
              {
                title: '姓名',
                dataIndex: ['student', 'name'],
                key: 'name',
              },
              {
                title: '状态',
                dataIndex: 'status',
                key: 'status',
                render: (status: string) => (
                  <Tag color={submissionStatusColor[status]}>
                    {submissionStatusText[status]}
                  </Tag>
                ),
              },
              {
                title: '最终得分',
                dataIndex: 'finalScore',
                key: 'finalScore',
                render: (score: number) => (score !== null && score !== undefined ? `${score} 分` : '-'),
              },
              {
                title: '评审数',
                dataIndex: 'reviews',
                key: 'reviewCount',
                render: (reviews: any[]) => reviews?.length || 0,
              },
              {
                title: '申诉',
                dataIndex: 'appeal',
                key: 'appeal',
                render: (appeal: any) =>
                  appeal ? <Tag color="orange">{appeal.status}</Tag> : '无',
              },
              {
                title: '提交时间',
                dataIndex: 'submittedAt',
                key: 'submittedAt',
                render: (time: string) =>
                  time ? dayjs(time).format('MM-DD HH:mm') : '-',
              },
            ]}
          />
        </Card>
      )}

      <Modal
        title={submission ? '修改提交' : '提交作业'}
        open={submitModalVisible}
        onCancel={() => setSubmitModalVisible(false)}
        width={600}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="content" label="作业内容">
            <TextArea rows={8} placeholder="请输入作业内容..." />
          </Form.Item>
          <Form.Item name="attachmentUrl" label="附件链接">
            <Input placeholder="请输入附件链接（可选）" />
          </Form.Item>
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setSubmitModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                提交
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>

      <Modal
        title="发起申诉"
        open={appealModalVisible}
        onCancel={() => setAppealModalVisible(false)}
        footer={null}
      >
        <Form form={appealForm} layout="vertical" onFinish={handleAppeal}>
          <Form.Item
            name="reason"
            label="申诉理由"
            rules={[{ required: true, message: '请输入申诉理由' }]}
          >
            <TextArea
              rows={6}
              placeholder="请详细描述您的申诉理由..."
            />
          </Form.Item>
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setAppealModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit" danger>
                提交申诉
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

export default AssignmentDetail;
