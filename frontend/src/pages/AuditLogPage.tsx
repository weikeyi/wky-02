import React, { useState, useEffect } from 'react';
import { Card, Table, Select, Tag, Space, Input, message } from 'antd';
import { AuditOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../utils/api';

const { Option } = Select;

function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [entity, setEntity] = useState<string>('');
  const [action, setAction] = useState<string>('');

  useEffect(() => {
    fetchLogs();
  }, [page, pageSize, entity, action]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: pageSize };
      if (entity) params.entity = entity;
      if (action) params.action = action;

      const response = await api.get('/audit', { params });
      setLogs(response.data.data);
      setTotal(response.data.total);
    } catch (error) {
      message.error('获取审计日志失败');
    } finally {
      setLoading(false);
    }
  };

  const entities = ['User', 'Course', 'Assignment', 'Submission', 'Review', 'Appeal'];
  const actions = [
    'LOGIN',
    'CREATE',
    'UPDATE',
    'DELETE',
    'SUBMIT',
    'REVIEW',
    'APPEAL',
    'RESOLVE',
    'PUBLISH',
    'ALLOCATE',
  ];

  const roleText: Record<string, string> = {
    STUDENT: '学生',
    TEACHER: '教师',
    TA: '助教',
  };

  const actionColor: Record<string, string> = {
    LOGIN: 'green',
    CREATE: 'blue',
    UPDATE: 'orange',
    DELETE: 'red',
    SUBMIT: 'cyan',
    REVIEW: 'purple',
    APPEAL: 'gold',
    RESOLVED: 'green',
    PUBLISH: 'geekblue',
    ALLOCATE: 'magenta',
  };

  const columns = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '用户',
      dataIndex: 'user',
      key: 'user',
      width: 150,
      render: (user: any) =>
        user ? (
          <Space>
            <span>{user.name}</span>
            <Tag color="default" style={{ fontSize: 10 }}>
              {roleText[user.role] || user.role}
            </Tag>
          </Space>
        ) : (
          <span style={{ color: '#999' }}>系统</span>
        ),
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 100,
      render: (action: string) => (
        <Tag color={actionColor[action] || 'default'}>{action}</Tag>
      ),
    },
    {
      title: '实体类型',
      dataIndex: 'entity',
      key: 'entity',
      width: 120,
    },
    {
      title: '实体ID',
      dataIndex: 'entityId',
      key: 'entityId',
      width: 100,
      render: (id: string) => (id ? id.slice(0, 8) + '...' : '-'),
    },
    {
      title: 'IP',
      dataIndex: 'ip',
      key: 'ip',
      width: 120,
      render: (ip: string) => ip || '-',
    },
  ];

  return (
    <div>
      <h2 className="page-title" style={{ marginBottom: 24 }}>
        <AuditOutlined style={{ marginRight: 8 }} />
        审计日志
      </h2>

      <Card style={{ marginBottom: 16 }}>
        <Space>
          <span>实体类型:</span>
          <Select
            style={{ width: 150 }}
            placeholder="全部"
            allowClear
            value={entity || undefined}
            onChange={(value) => {
              setEntity(value || '');
              setPage(1);
            }}
          >
            {entities.map((e) => (
              <Option key={e} value={e}>
                {e}
              </Option>
            ))}
          </Select>

          <span>操作类型:</span>
          <Select
            style={{ width: 150 }}
            placeholder="全部"
            allowClear
            value={action || undefined}
            onChange={(value) => {
              setAction(value || '');
              setPage(1);
            }}
          >
            {actions.map((a) => (
              <Option key={a} value={a}>
                {a}
              </Option>
            ))}
          </Select>
        </Space>
      </Card>

      <Card>
        <Table
          loading={loading}
          dataSource={logs}
          rowKey="id"
          columns={columns}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (page, pageSize) => {
              setPage(page);
              setPageSize(pageSize);
            },
          }}
          size="small"
        />
      </Card>
    </div>
  );
}

export default AuditLogPage;
