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
  Divider,
  Descriptions,
  Tabs,
  Table,
} from 'antd';
import {
  ArrowLeftOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../utils/api';
import { Appeal, Submission, Review } from '../types';
import { useAuth } from '../contexts/AuthContext';

const { TextArea } = Input;

function AppealPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [appeal, setAppeal] = useState<Appeal | null>(null);
  const [loading, setLoading] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchAppeal();
  }, [id]);

  const fetchAppeal = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/appeals/${id}`);
      setAppeal(response.data);
    } catch (error) {
      message.error('获取申诉详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = (status: string) => {
    setReviewModalVisible(true);
    form.setFieldsValue({ status });
  };

  const handleSubmitReview = async (values: any) => {
    try {
      await api.post(`/appeals/${id}/resolve`, {
        taScore: values.taScore,
        taComment: values.taComment,
        status: values.status,
      });
      message.success('处理完成');
      setReviewModalVisible(false);
      fetchAppeal();
    } catch (error: any) {
      message.error(error.response?.data?.error || '处理失败');
    }
  };

  const statusText: Record<string, string> = {
    PENDING: '待处理',
    REVIEWING: '处理中',
    RESOLVED: '已解决',
    REJECTED: '已驳回',
  };

  const statusColor: Record<string, string> = {
    PENDING: 'processing',
    REVIEWING: 'blue',
    RESOLVED: 'success',
    REJECTED: 'default',
  };

  const isStaff = user?.role === 'TEACHER' || user?.role === 'TA';

  return (
    <div>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/appeals')}
        style={{ marginBottom: 16 }}
      >
        返回
      </Button>

      <Card
        loading={loading}
        title={
          <Space>
            <ExclamationCircleOutlined />
            申诉详情
            <Tag color={statusColor[appeal?.status || 'PENDING']}>
              {statusText[appeal?.status || 'PENDING']}
            </Tag>
          </Space>
        }
        extra={
          isStaff && appeal?.status === 'PENDING' && (
            <Space>
              <Button type="primary" onClick={() => handleReview('RESOLVED')}>
                处理申诉
              </Button>
            </Space>
          )
        }
      >
        <Descriptions column={2}>
          <Descriptions.Item label="申诉人">
            {appeal?.appellant?.name}
          </Descriptions.Item>
          <Descriptions.Item label="申诉时间">
            {dayjs(appeal?.createdAt).format('YYYY-MM-DD HH:mm')}
          </Descriptions.Item>
          <Descriptions.Item label="作业">
            {appeal?.assignment?.title}
          </Descriptions.Item>
          <Descriptions.Item label="原得分">
            {appeal?.submission?.finalScore} 分
          </Descriptions.Item>
        </Descriptions>

        <Divider />

        <h4>申诉理由</h4>
        <div
          style={{
            background: '#f5f5f5',
            padding: 16,
            borderRadius: 4,
            whiteSpace: 'pre-wrap',
          }}
        >
          {appeal?.reason}
        </div>

        {appeal?.submission?.content && (
          <>
            <Divider />
            <h4>作业原文</h4>
            <div
              style={{
                background: '#f9f9f9',
                padding: 16,
                borderRadius: 4,
                whiteSpace: 'pre-wrap',
                maxHeight: 300,
                overflow: 'auto',
              }}
            >
              {appeal.submission.content}
            </div>
          </>
        )}

        {appeal?.submission?.reviews && appeal.submission.reviews.length > 0 && (
          <>
            <Divider />
            <h4>互评记录</h4>
            {appeal.submission.reviews.map((review: any, index: number) => (
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
                      {review.criterionScores.map((cs: any) => (
                        <li key={cs.id}>
                          {appeal?.assignment?.rubric?.find((r: any) => r.id === cs.criterionId)?.name || '评分项'}: {cs.score} 分
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            ))}
          </>
        )}

        {appeal?.taReviewer && (
          <>
            <Divider />
            <h4>助教复核</h4>
            <Descriptions column={2}>
              <Descriptions.Item label="复核人">
                {appeal.taReviewer.name}
              </Descriptions.Item>
              <Descriptions.Item label="复核时间">
                {appeal.reviewedAt && dayjs(appeal.reviewedAt).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="复核得分">
                {appeal.taScore !== undefined && appeal.taScore !== null
                  ? `${appeal.taScore} 分`
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="最终得分">
                {appeal.finalScore !== undefined && appeal.finalScore !== null
                  ? `${appeal.finalScore} 分`
                  : '-'}
              </Descriptions.Item>
            </Descriptions>
            {appeal.taComment && (
              <div style={{ marginTop: 12 }}>
                <p><strong>复核意见:</strong></p>
                <div
                  style={{
                    background: '#f5f5f5',
                    padding: 12,
                    borderRadius: 4,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {appeal.taComment}
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <Modal
        title="处理申诉"
        open={reviewModalVisible}
        onCancel={() => setReviewModalVisible(false)}
        width={600}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmitReview}>
          <Form.Item name="status" hidden>
            <Input />
          </Form.Item>
          <Form.Item
            name="taScore"
            label="复核分数"
            rules={[{ required: true, message: '请输入复核分数' }]}
          >
            <InputNumber min={0} max={100} style={{ width: '100%' }} placeholder="请输入复核分数" />
          </Form.Item>
          <Form.Item
            name="taComment"
            label="复核意见"
            rules={[{ required: true, message: '请输入复核意见' }]}
          >
            <TextArea rows={4} placeholder="请输入复核意见..." />
          </Form.Item>
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setReviewModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                提交
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

export default AppealPage;
