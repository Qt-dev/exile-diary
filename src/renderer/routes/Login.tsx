import React from 'react';
import { Outlet } from 'react-router-dom';
import './Login.css';

const Login = () => {
  return (
    <div className="Login">
      <Outlet />
    </div>
  );
}

export default Login;
