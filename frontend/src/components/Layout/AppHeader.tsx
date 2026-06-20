import React from 'react';
import { Layout, Menu, Dropdown, Avatar, Space } from 'antd';
import {
  BookOutlined,
  UserOutlined,
  FileTextOutlined,
  DashboardOutlined,
  AuditOutlined,
  LogoutOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const { Header } = Layout;

function AppHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const roleText: Record<string, string> = {
    STUDENT: '学生',
    TEACHER: '教师',
    TA: '助教',
  };

  const userMenu = {
    items: [
      {
        key: 'profile',
        icon: <UserOutlined />,
        label: `${user?.name} (${roleText[user?.role || 'STUDENT']})`,
        disabled: true,
      },
      {
        type: 'divider' as const,
      },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: '退出登录',
        onClick: handleLogout,
      },
    ],
  };

  const menuItems = [
    {
      key: '/courses',
      icon: <BookOutlined />,
      label: '课程',
      onClick: () => navigate('/courses'),
    },
  ];

  if (user?.role === 'STUDENT') {
    menuItems.push({
      key: '/appeals',
      icon: <ExclamationCircleOutlined />,
      label: '我的申诉',
      onClick: () => navigate('/appeals'),
    });
  }

  if (user?.role === 'TEACHER' || user?.role === 'TA') {
    menuItems.push({
      key: '/audit',
      icon: <AuditOutlined />,
      label: '审计日志',
      onClick: () => navigate('/audit'),
    });
  }

  return (
    <Header className="app-header" style={{ background: '#001529', padding: '0 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 48 }}>
        <div
          className="logo"
          style={{ color: 'white', fontSize: 18, fontWeight: 'bold', cursor: 'pointer' }}
          onClick={() => navigate('/')}
        >
          📚 互评管理平台
        </div>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={menuItems}
          style={{ minWidth: 0, flex: 1, borderBottom: 'none', background: 'transparent' }}
        />
      </div>
      <div className="user-info">
        <Dropdown menu={userMenu} placement="bottomRight">
          <Space style={{ cursor: 'pointer', color: 'white' }}>
            <Avatar icon={<UserOutlined />} />
            <span>{user?.name}</span>
          </Space>
        </Dropdown>
      </div>
    </Header>
  );
}

export default AppHeader;
