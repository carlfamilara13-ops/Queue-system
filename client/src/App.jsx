import { useEffect, useState } from 'react'; import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { api, Auth } from './api'; import { Feedback, Spinner } from './ui'; import Login from './Login'; import Student from './Student'; import Dashboard from './Dashboard';
export default function App() {
  const [user, setUser] = useState(undefined);
  useEffect(() => { api('/me').then(setUser).catch(() => setUser(null)); }, []);
  if (user === undefined) return <Spinner />;
  const home = !user ? '/login' : { student: '/app', staff: '/staff', admin: '/admin' }[user.role];
  const only = (role, el) => user?.role === role ? el : <Navigate to={home} />;
  return <Feedback><Auth.Provider value={{ user, setUser }}><BrowserRouter><Routes>
    <Route path="/login" element={user ? <Navigate to={home} /> : <Login />} />
    <Route path="/app" element={only('student', <Student />)} />
    <Route path="/staff" element={only('staff', <Dashboard />)} />
    <Route path="/admin" element={only('admin', <Dashboard />)} />
    <Route path="*" element={<Navigate to={home} />} />
  </Routes></BrowserRouter></Auth.Provider></Feedback>;
}
