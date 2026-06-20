import React, { useState, useEffect } from 'react';
import { Card, List, Tag, Button, Space, Modal, Form, Input, message, Row, Col } from 'antd';
import {
  BookOutlined,
  PlusOutlined,
  TeamOutlined,
  FileTextOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { Course } from '../types';
import { useAuth } from '../contexts/AuthContext';

function CourseList() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const response = await api.get('/courses');
      setCourses(response.data);
    } catch (error) {
      message.error('获取课程列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCourse = async (values: any) => {
    try {
      await api.post('/courses', values);
      message.success('创建课程成功');
      setModalVisible(false);
      form.resetFields();
      fetchCourses();
    } catch (error: any) {
      message.error(error.response?.data?.error || '创建失败');
    }
  };

  const handleEnroll = async (courseCode: string) => {
    try {
      const courses = await api.get('/courses');
      const targetCourse = courses.data.find((c: Course) => c.code === courseCode);
      if (!targetCourse) {
        message.error('课程不存在');
        return;
      }
      await api.post(`/courses/${targetCourse.id}/enroll`);
      message.success('选课成功');
      fetchCourses();
    } catch (error: any) {
      message.error(error.response?.data?.error || '选课失败');
    }
  };

  const roleTagColor: Record<string, string> = {
    TEACHER: 'purple',
    TA: 'blue',
    STUDENT: 'green',
  };

  const roleText: Record<string, string> = {
    TEACHER: '教师',
    TA: '助教',
    STUDENT: '学生',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 className="page-title" style={{ margin: 0 }}>
          <BookOutlined style={{ marginRight: 8 }} />
          我的课程
        </h2>
        <Space>
          {user?.role === 'STUDENT' && (
            <Button
              icon={<PlusOutlined />}
              onClick={() => {
                Modal.confirm({
                  title: '加入课程',
                  content: (
                    <Form form={Form.useForm()[0]} layout="vertical">
                      <Form.Item
                        name="courseCode"
                        label="课程代码"
                        rules={[{ required: true, message: '请输入课程代码' }]}
                      >
                        <Input placeholder="请输入课程代码" />
                      </Form.Item>
                    </Form>
                  ),
                  onOk: async () => {
                    const form = Form.useFormInstance();
                    // 简化处理
                  },
                });
              }}
            >
              加入课程
            </Button>
          )}
          {user?.role === 'TEACHER' && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
              创建课程
            </Button>
          )}
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        {courses.map((course) => (
          <Col xs={24} sm={12} lg={8} key={course.id}>
            <Card
              hoverable
              onClick={() => navigate(`/courses/${course.id}`)}
              style={{ height: '100%' }}
            >
              <Card.Meta
                title={
                  <Space>
                    <span>{course.name}</span>
                    <Tag color={roleTagColor[course.role || 'STUDENT']}>
                      {roleText[course.role || 'STUDENT']}
                    </Tag>
                  </Space>
                }
                description={
                  <div style={{ marginTop: 12 }}>
                    <div style={{ color: '#666', marginBottom: 8 }}>
                      课程代码: {course.code}
                    </div>
                    <Space split={<span style={{ color: '#e8e8e8' }}>|</span>}>
                      <span style={{ color: '#999' }}>
                        <TeamOutlined style={{ marginRight: 4 }} />
                        {course.memberCount || 0} 人
                      </span>
                      <span style={{ color: '#999' }}>
                        <FileTextOutlined style={{ marginRight: 4 }} />
                        {course.assignmentCount || 0} 个作业
                      </span>
                    </Space>
                    {course.description && (
                      <div
                        style={{
                          marginTop: 12,
                          color: '#666',
                          fontSize: 13,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {course.description}
                      </div>
                    )}
                  </div>
                }
              />
            </Card>
          </Col>
        ))}
      </Row>

      {courses.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
          <BookOutlined style={{ fontSize: 48, marginBottom: 16 }} />
          <div>暂无课程</div>
        </div>
      )}

      <Modal
        title="创建课程"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateCourse}>
          <Form.Item
            name="name"
            label="课程名称"
            rules={[{ required: true, message: '请输入课程名称' }]}
          >
            <Input placeholder="请输入课程名称" />
          </Form.Item>
          <Form.Item
            name="code"
            label="课程代码"
            rules={[{ required: true, message: '请输入课程代码' }]}
          >
            <Input placeholder="请输入课程代码" />
          </Form.Item>
          <Form.Item name="description" label="课程描述">
            <Input.TextArea rows={3} placeholder="请输入课程描述" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                创建
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default CourseList;
