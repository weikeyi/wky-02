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
  DatePicker,
  InputNumber,
  Switch,
  Select,
  message,
  Tabs,
  Table,
  Avatar,
  Row,
  Col,
  Statistic,
  Divider,
} from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  FileTextOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  UserOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../utils/api';
import { Course, Assignment, User } from '../types';
import { useAuth } from '../contexts/AuthContext';

const { RangePicker } = DatePicker;
const { TextArea } = Input;
const { Option } = Select;

function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [assignmentModalVisible, setAssignmentModalVisible] = useState(false);
  const [rubricItems, setRubricItems] = useState<any[]>([
    { name: '', maxScore: 10, weight: 1 },
  ]);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchCourse();
    fetchAssignments();
    if (user?.role !== 'STUDENT') {
      fetchStudents();
    }
  }, [id]);

  const fetchCourse = async () => {
    try {
      const response = await api.get(`/courses/${id}`);
      setCourse(response.data);
    } catch (error) {
      message.error('获取课程详情失败');
    }
  };

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/assignments/course/${id}`);
      setAssignments(response.data);
    } catch (error) {
      message.error('获取作业列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const response = await api.get(`/courses/${id}/students`);
      setStudents(response.data);
    } catch (error) {
      console.error('获取学生列表失败');
    }
  };

  const handleCreateAssignment = async (values: any) => {
    try {
      const data = {
        courseId: id,
        title: values.title,
        description: values.description,
        submissionDeadline: values.deadline[0].toISOString(),
        reviewDeadline: values.deadline[1].toISOString(),
        reviewsPerSubmission: values.reviewsPerSubmission,
        anonymousReview: values.anonymousReview,
        dropHighestLowest: values.dropHighestLowest,
        lateDeductionType: values.lateDeductionType,
        lateDeductionValue: values.lateDeductionValue,
        lateDeductionMax: values.lateDeductionMax,
        incompleteReviewPenalty: values.incompleteReviewPenalty,
        maxScore: values.maxScore,
        rubric: rubricItems.filter((item) => item.name && item.maxScore > 0),
      };

      await api.post('/assignments', data);
      message.success('创建作业成功');
      setAssignmentModalVisible(false);
      form.resetFields();
      setRubricItems([{ name: '', maxScore: 10, weight: 1 }]);
      fetchAssignments();
    } catch (error: any) {
      message.error(error.response?.data?.error || '创建失败');
    }
  };

  const addRubricItem = () => {
    setRubricItems([...rubricItems, { name: '', maxScore: 10, weight: 1 }]);
  };

  const removeRubricItem = (index: number) => {
    const newItems = rubricItems.filter((_, i) => i !== index);
    setRubricItems(newItems);
  };

  const updateRubricItem = (index: number, field: string, value: any) => {
    const newItems = [...rubricItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setRubricItems(newItems);
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

  const isTeacher = user?.role === 'TEACHER';
  const isTA = user?.role === 'TA';
  const isStaff = isTeacher || isTA;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/courses')}
          style={{ marginBottom: 16 }}
        >
          返回课程列表
        </Button>
        <h2 style={{ margin: 0 }}>{course?.name}</h2>
        <div style={{ color: '#666', marginTop: 8 }}>
          课程代码: {course?.code}
          {course?.teacher && ` | 教师: ${course.teacher.name}`}
        </div>
        {course?.description && (
          <div style={{ marginTop: 8, color: '#888' }}>{course.description}</div>
        )}
      </div>

      <Tabs
        items={[
          {
            key: 'assignments',
            label: '作业',
            children: (
              <div>
                {isTeacher && (
                  <div style={{ marginBottom: 16, textAlign: 'right' }}>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => setAssignmentModalVisible(true)}
                    >
                      创建作业
                    </Button>
                  </div>
                )}

                <List
                  loading={loading}
                  dataSource={assignments}
                  renderItem={(item) => (
                    <List.Item
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/assignments/${item.id}`)}
                    >
                      <List.Item.Meta
                        title={
                          <Space>
                            <FileTextOutlined />
                            {item.title}
                            <Tag color={statusTagColor[item.currentStatus]}>
                              {statusText[item.currentStatus]}
                            </Tag>
                          </Space>
                        }
                        description={
                          <Space split={<span style={{ color: '#e8e8e8' }}>|</span>}>
                            <span style={{ color: '#999' }}>
                              <CalendarOutlined style={{ marginRight: 4 }} />
                              提交截止: {dayjs(item.submissionDeadline).format('YYYY-MM-DD HH:mm')}
                            </span>
                            <span style={{ color: '#999' }}>
                              <ClockCircleOutlined style={{ marginRight: 4 }} />
                              互评截止: {dayjs(item.reviewDeadline).format('YYYY-MM-DD HH:mm')}
                            </span>
                          </Space>
                        }
                      />
                      <div style={{ color: '#999' }}>
                        {item._count?.submissions || 0} 份提交
                      </div>
                    </List.Item>
                  )}
                />

                {assignments.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
                    <FileTextOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                    <div>暂无作业</div>
                  </div>
                )}
              </div>
            ),
          },
          ...(isStaff
            ? [
                {
                  key: 'students',
                  label: '学生',
                  children: (
                    <Table
                      dataSource={students}
                      rowKey="id"
                      columns={[
                        {
                          title: '学号',
                          dataIndex: ['user', 'studentId'],
                          key: 'studentId',
                        },
                        {
                          title: '姓名',
                          dataIndex: ['user', 'name'],
                          key: 'name',
                        },
                        {
                          title: '邮箱',
                          dataIndex: ['user', 'email'],
                          key: 'email',
                        },
                      ]}
                    />
                  ),
                },
              ]
            : []),
        ]}
      />

      <Modal
        title="创建作业"
        open={assignmentModalVisible}
        onCancel={() => setAssignmentModalVisible(false)}
        width={700}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateAssignment}>
          <Form.Item
            name="title"
            label="作业标题"
            rules={[{ required: true, message: '请输入作业标题' }]}
          >
            <Input placeholder="请输入作业标题" />
          </Form.Item>
          <Form.Item name="description" label="作业描述">
            <TextArea rows={3} placeholder="请输入作业描述" />
          </Form.Item>
          <Form.Item
            name="deadline"
            label="时间安排"
            rules={[{ required: true, message: '请选择时间' }]}
          >
            <RangePicker
              showTime
              style={{ width: '100%' }}
              placeholder={['提交截止时间', '互评截止时间']}
            />
          </Form.Item>

          <Divider style={{ margin: '12px 0' }} />
          <h4>互评设置</h4>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="reviewsPerSubmission"
                label="每份作业评审人数"
                initialValue={3}
              >
                <InputNumber min={1} max={10} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="maxScore"
                label="满分"
                initialValue={100}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="anonymousReview" label="匿名互评" valuePropName="checked" initialValue={true}>
                <Switch />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="dropHighestLowest" label="去掉最高最低分" valuePropName="checked" initialValue={true}>
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: '12px 0' }} />
          <h4>迟交扣分</h4>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="lateDeductionType"
                label="扣分方式"
                initialValue="NONE"
              >
                <Select>
                  <Option value="NONE">不扣分</Option>
                  <Option value="FIXED">固定扣分</Option>
                  <Option value="PER_DAY">按天扣分</Option>
                  <Option value="PER_HOUR">按小时扣分</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="lateDeductionValue"
                label="扣分值（分）"
                initialValue={5}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="lateDeductionMax"
                label="最大扣分比例（%）"
                initialValue={30}
              >
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="incompleteReviewPenalty"
                label="未完成互评扣分（分/个）"
                initialValue={5}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: '12px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0 }}>评分标准 (Rubric)</h4>
            <Button size="small" icon={<PlusOutlined />} onClick={addRubricItem}>
              添加评分项
            </Button>
          </div>

          {rubricItems.map((item, index) => (
            <Row key={index} gutter={8} style={{ marginTop: 8 }} align="middle">
              <Col span={10}>
                <Input
                  placeholder="评分项名称"
                  value={item.name}
                  onChange={(e) => updateRubricItem(index, 'name', e.target.value)}
                />
              </Col>
              <Col span={6}>
                <InputNumber
                  placeholder="满分"
                  value={item.maxScore}
                  min={0}
                  style={{ width: '100%' }}
                  onChange={(value) => updateRubricItem(index, 'maxScore', value)}
                />
              </Col>
              <Col span={6}>
                <InputNumber
                  placeholder="权重"
                  value={item.weight}
                  min={0}
                  step={0.5}
                  style={{ width: '100%' }}
                  onChange={(value) => updateRubricItem(index, 'weight', value)}
                />
              </Col>
              <Col span={2}>
                <Button
                  danger
                  size="small"
                  onClick={() => removeRubricItem(index)}
                  disabled={rubricItems.length === 1}
                >
                  删除
                </Button>
              </Col>
            </Row>
          ))}

          <Divider style={{ margin: '24px 0 12px' }} />

          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setAssignmentModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                创建
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

export default CourseDetail;
