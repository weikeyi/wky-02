import React, { useState, useEffect } from 'react';
import {
  Card,
  List,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  message,
  Steps,
  Divider,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { Review, Assignment } from '../types';

const { TextArea } = Input;

function ReviewPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentReview, setCurrentReview] = useState<Review | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchReviews();
    fetchAssignment();
  }, [assignmentId]);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/reviews/my/assignment/${assignmentId}`);
      setReviews(response.data);
    } catch (error) {
      message.error('获取互评任务失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignment = async () => {
    try {
      const response = await api.get(`/assignments/${assignmentId}`);
      setAssignment(response.data);
    } catch (error) {
      console.error('获取作业详情失败');
    }
  };

  const handleReview = (review: Review) => {
    setCurrentReview(review);

    const rubric = assignment?.rubric || [];
    const existingScores = review.criterionScores || [];

    const scores = rubric.map((criterion) => {
      const existing = existingScores.find((s) => s.criterionId === criterion.id);
      return {
        criterionId: criterion.id,
        score: existing?.score ?? null,
        comment: existing?.comment ?? '',
      };
    });

    form.setFieldsValue({
      scores,
      overallComment: review.overallComment || '',
    });

    setModalVisible(true);
  };

  const handleSave = async (values: any) => {
    if (!currentReview) return;

    try {
      const scores = values.scores.map((s: any) => ({
        criterionId: s.criterionId,
        score: s.score,
        comment: s.comment,
      }));

      await api.put(`/reviews/${currentReview.id}`, {
        scores,
        overallComment: values.overallComment,
        status: 'IN_PROGRESS',
      });

      message.success('保存成功');
      fetchReviews();
    } catch (error: any) {
      message.error(error.response?.data?.error || '保存失败');
    }
  };

  const handleSubmit = async () => {
    if (!currentReview) return;

    try {
      const values = form.getFieldsValue();
      const scores = values.scores.map((s: any) => ({
        criterionId: s.criterionId,
        score: s.score,
        comment: s.comment,
      }));

      await api.put(`/reviews/${currentReview.id}`, {
        scores,
        overallComment: values.overallComment,
      });

      await api.post(`/reviews/${currentReview.id}/submit`);
      message.success('提交成功');
      setModalVisible(false);
      fetchReviews();
    } catch (error: any) {
      message.error(error.response?.data?.error || '提交失败');
    }
  };

  const statusText: Record<string, string> = {
    ASSIGNED: '待评审',
    IN_PROGRESS: '进行中',
    COMPLETED: '已完成',
  };

  const statusColor: Record<string, string> = {
    ASSIGNED: 'default',
    IN_PROGRESS: 'processing',
    COMPLETED: 'success',
  };

  const completedCount = reviews.filter((r) => r.status === 'COMPLETED').length;
  const totalCount = reviews.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(`/assignments/${assignmentId}`)}
        style={{ marginBottom: 16 }}
      >
        返回作业
      </Button>

      <Card
        title="我的互评任务"
        extra={
          <Tag color="blue">
            {completedCount}/{totalCount} 已完成
          </Tag>
        }
      >
        <Steps
          direction="vertical"
          current={completedCount}
          items={reviews.map((review, index) => ({
            title: `评审 ${index + 1}`,
            description: (
              <div>
                <Space>
                  <Tag color={statusColor[review.status]}>
                    {statusText[review.status]}
                  </Tag>
                  {review.overallScore !== null && review.overallScore !== undefined && (
                    <span>得分: {review.overallScore}</span>
                  )}
                </Space>
                <div style={{ marginTop: 8 }}>
                  <Button
                    type="link"
                    onClick={() => handleReview(review)}
                  >
                    {review.status === 'COMPLETED' ? '查看详情' : '开始评审'}
                  </Button>
                </div>
              </div>
            ),
            status: review.status === 'COMPLETED' ? 'finish' : review.status === 'IN_PROGRESS' ? 'process' : 'wait',
          }))}
        />

        {reviews.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            <FileTextOutlined style={{ fontSize: 36, marginBottom: 12 }} />
            <div>暂无互评任务</div>
          </div>
        )}
      </Card>

      <Modal
        title="作业评审"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={700}
        footer={null}
        destroyOnClose
      >
        {currentReview && (
          <div>
            <Card size="small" title="作业内容" style={{ marginBottom: 16 }}>
              {currentReview.submission?.content ? (
                <div style={{ whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>
                  {currentReview.submission.content}
                </div>
              ) : (
                <div style={{ color: '#999' }}>无文字内容</div>
              )}
              {currentReview.submission?.attachmentUrl && (
                <div style={{ marginTop: 8 }}>
                  <a href={currentReview.submission.attachmentUrl} target="_blank" rel="noopener noreferrer">
                    查看附件
                  </a>
                </div>
              )}
            </Card>

            <Form
              form={form}
              layout="vertical"
              onFinish={handleSave}
              initialValues={{ scores: [] }}
            >
              <Form.List name="scores">
                {(fields, { add, remove }) => (
                  <>
                    {assignment?.rubric?.map((criterion, index) => (
                      <div key={criterion.id} style={{ marginBottom: 16 }}>
                        <Divider style={{ margin: '12px 0' }} />
                        <h4 style={{ marginBottom: 8 }}>
                          {criterion.name}
                          <span style={{ color: '#999', fontSize: 12, marginLeft: 8 }}>
                            (满分 {criterion.maxScore} 分)
                          </span>
                        </h4>
                        {criterion.description && (
                          <p style={{ color: '#666', fontSize: 12, marginBottom: 8 }}>
                            {criterion.description}
                          </p>
                        )}
                        <Form.Item
                          name={[index, 'criterionId']}
                          hidden
                        >
                          <Input />
                        </Form.Item>
                        <Form.Item
                          name={[index, 'score']}
                          rules={[
                            { required: true, message: '请打分' },
                            {
                              type: 'number',
                              min: 0,
                              max: criterion.maxScore,
                              message: `分数必须在 0 - ${criterion.maxScore} 之间`,
                            },
                          ]}
                        >
                          <InputNumber
                            min={0}
                            max={criterion.maxScore}
                            style={{ width: 120 }}
                            placeholder="请打分"
                          />
                        </Form.Item>
                        <Form.Item name={[index, 'comment']}>
                          <TextArea
                            rows={2}
                            placeholder="评语（可选）"
                          />
                        </Form.Item>
                      </div>
                    ))}
                  </>
                )}
              </Form.List>

              <Divider style={{ margin: '12px 0' }} />
              <Form.Item name="overallComment" label="总体评语">
                <TextArea rows={3} placeholder="请输入总体评语..." />
              </Form.Item>

              <div style={{ textAlign: 'right' }}>
                <Space>
                  <Button onClick={() => setModalVisible(false)}>取消</Button>
                  {currentReview.status !== 'COMPLETED' && (
                    <>
                      <Button onClick={() => handleSave(form.getFieldsValue())}>
                        保存草稿
                      </Button>
                      <Button type="primary" onClick={handleSubmit}>
                        提交评审
                      </Button>
                    </>
                  )}
                </Space>
              </div>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default ReviewPage;
