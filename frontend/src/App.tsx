import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from 'antd';
import { useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import CourseList from './pages/CourseList';
import CourseDetail from './pages/CourseDetail';
import AssignmentDetail from './pages/AssignmentDetail';
import ReviewPage from './pages/ReviewPage';
import AppealPage from './pages/AppealPage';
import Dashboard from './pages/Dashboard';
import AuditLogPage from './pages/AuditLogPage';
import MyAppeals from './pages/MyAppeals';
import AppHeader from './components/Layout/AppHeader';

const { Content, Footer } = Layout;

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: 20, textAlign: 'center' }}>加载中...</div>;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Layout className="app-layout">
      <AppHeader />
      <Content className="app-content">
        <Routes>
          <Route path="/" element={<CourseList />} />
          <Route path="/courses" element={<CourseList />} />
          <Route path="/courses/:id" element={<CourseDetail />} />
          <Route path="/assignments/:id" element={<AssignmentDetail />} />
          <Route path="/reviews/:assignmentId" element={<ReviewPage />} />
          <Route path="/appeals" element={<MyAppeals />} />
          <Route path="/appeals/:id" element={<AppealPage />} />
          <Route path="/dashboard/:assignmentId" element={<Dashboard />} />
          <Route path="/audit" element={<AuditLogPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Content>
      <Footer className="app-footer">
        课程作业互评与申诉管理平台 ©{new Date().getFullYear()}
      </Footer>
    </Layout>
  );
}

export default App;
