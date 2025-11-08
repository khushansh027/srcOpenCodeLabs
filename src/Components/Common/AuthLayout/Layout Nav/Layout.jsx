// Layout.jsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import Footer from './Footer.jsx';
import Navbar from './Navbar.jsx';
import AdminCoursesList from '../../../AdminSpecific/AdminCoursesList.jsx';

const Layout = () => {
  return (
    <>
      <Navbar />
      <main>
        <Outlet /> {/* renders current route */}
        {/* <AdminCoursesList /> */}
      </main>
      <Footer />
    </>
  );
}

export default Layout;
