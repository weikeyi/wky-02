import React, { useState, useEffect } from 'react';
import { Card, List, Tag, Button, Space, message, Tabs, Table } from 'antd';
import {
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../utils/api';
import { Appeal } from '../types';
import { useAuth } from '../contexts/AuthContext';

function MyAppeals() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [myAppeals, setMyAppeals] = useState<Appeal[]>([]);
  const [allAppeals, setAllAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('my');

  useEffect(() => {
    if (user?.role === 'STUDENT') {
      fetchMyAppeals();
      setActiveTab('my');
    } else {
      fetchAllAppeals();
      setActiveTab('all');
    }
  }, [user]);

  const fetchMyAppeals = async () => {
    setLoading(true);
    try {
      const response = await api.get('/appeals/my');
      setMyAppeals(response.data);
    } catch (error) {
      message.error('获取申诉列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllAppeals = async () => {
    setLoading(true);
    try {
      const coursesResponse = await api.get('/courses');
      const staffCourses = coursesResponse.data.filter((c: any) => {
        const membership = c._count?.members > 0 || c.members?.length > 0 || c.teacherId === user?.id;
        return membership;
      });

      const allAppealsPromises = staffCourses.map(async (course: any) => {
        try {
          const response = await api.get(`/appeals/course/${course.id}`);
          return response.data.map((appeal: any) => ({
            ...appeal,
            courseName: course.name,
            courseCode: course.code,
          }));
        } catch (e) {
          return [];
        }
      });

      const results = await Promise.all(allAppealsPromises);
      const all = results.flat().sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setAllAppeals(all);
    } catch (error) {
      console.error('获取申诉列表失败', error);
      message.error('获取申诉列表失败');
    } finally {
      setLoading(false);
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

  const renderAppealList = (appeals: Appeal[]) => (
    <List
      loading={loading}
      dataSource={appeals}
      renderItem={(item) => (
        <List.Item
          style={{ cursor: 'pointer' }}
          onClick={() => navigate(`/appeals/${item.id}`)}
        >
          <List.Item.Meta
            avatar={<ExclamationCircleOutlined style={{ fontSize: 24, color: '#faad14' }} />}
            title={
              <Space>
                {item.assignment?.title || '作业申诉'}
                {item.courseName && (
                  <Tag color="blue">{item.courseName}</Tag>
                )}
                <Tag color={statusColor[item.status]}>
                  {statusText[item.status]}
                </Tag>
              </Space>
            }
            description={
              <div>
                <div style={{ color: '#666', marginBottom: 4 }}>
                  申诉时间: {dayjs(item.createdAt).format('YYYY-MM-DD HH:mm')}
                </div>
                <div style={{ color: '#999' }}>
                  {item.reason.length > 50 ? item.reason.slice(0, 50) + '...' : item.reason}
                </div>
              </div>
            }
          />
          <div style={{ textAlign: 'right' }}>
            <div>
              原得分: <strong>{item.submission?.finalScore ?? '-'}</strong> 分
            </div>
            {item.finalScore !== undefined && item.finalScore !== null && (
              <div style={{ color: '#52c41a' }}>
                复核分: <strong>{item.finalScore}</strong> 分
              </div>
            )}
          </div>
        </List.Item>
      )}
    />
  );

  const isStaff = user?.role === 'TEACHER' || user?.role === 'TA';
  const isStudent = user?.role === 'STUDENT';

  const tabs = [];
  if (isStudent) {
    tabs.push({
      key: 'my',
      label: '我的申诉',
      children: renderAppealList(myAppeals),
    });
  }
  if (isStaff) {
    tabs.push({
      key: 'all',
      label: '待处理申诉',
      children: renderAppealList(allAppeals.filter(a => a.status === 'PENDING')),
    });
    tabs.push({
      key: 'all-all',
      label: '全部申诉',
      children: renderAppealList(allAppeals),
    });
  }

  return (
    <div>
      <h2 className="page-title" style={{ marginBottom: 24 }}>
        <ExclamationCircleOutlined style={{ marginRight: 8 }} />
        申诉管理
      </h2>

      {tabs.length > 1 ? (
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabs} />
      ) : (
        <Card>{tabs[0]?.children}</Card>
      )}

      {(isStudent && myAppeals.length === 0) && (
        <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
          <ExclamationCircleOutlined style={{ fontSize: 48, marginBottom: 16 }} />
          <div>暂无申诉</div>
        </div>
      )}
    </div>
  );
}

export default MyAppeals;
