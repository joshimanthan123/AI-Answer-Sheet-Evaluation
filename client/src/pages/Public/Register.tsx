import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import Input from '../../components/ui/Input';
import Dropdown from '../../components/ui/Dropdown';
import Button from '../../components/ui/Button';

export const Register: React.FC = () => {
  const { register, isAuthenticated, user } = useAuth();
  const { addToast } = useNotifications();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'student' | 'faculty' | 'admin'>('student');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [lecturerId, setLecturerId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(`/${user.role}`, { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !confirmPassword) {
      setError('All fields are required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (role === 'faculty' && !lecturerId) {
      setError('Lecturer ID is required.');
      return;
    }
    if (role === 'student' && !studentId) {
      setError('Student ID / Enrollment Number is required.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await register(
        name,
        email,
        role,
        password,
        confirmPassword,
        role === 'faculty' ? lecturerId : undefined,
        role === 'student' ? studentId : undefined
      );
      addToast('Account created successfully. Please login.', 'success');
      navigate('/auth/login');
    } catch (err: any) {
      const msg = err?.message || 'Registration issue occurred.';
      setError(msg);
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const roleOptions = [
    { value: 'student', label: 'Student Portal' },
    { value: 'faculty', label: 'Faculty Evaluation Suite' },
    { value: 'admin', label: 'Admin Configuration Desk' }
  ];

  return (
    <div className="flex flex-col gap-6 text-left">
      <div>
        <h2 className="text-xl font-bold text-on-surface">Create an Account</h2>
        <p className="text-xs text-on-surface-variant mt-1">Join the automated grading platform</p>
      </div>

      {error && (
        <div className="p-3 bg-error-container/30 border border-error/20 text-error rounded-xl text-xs font-semibold">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Dropdown 
          label="Institutional Role" 
          options={roleOptions} 
          value={role}
          onChange={(e) => {
            setRole(e.target.value as any);
            setError('');
          }}
        />

        <Input 
          label="Full Name" 
          type="text" 
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Professor or Student Name"
          required
        />

        {role === 'faculty' && (
          <Input 
            label="Lecturer ID" 
            type="text" 
            value={lecturerId}
            onChange={(e) => setLecturerId(e.target.value)}
            placeholder="e.g. CHARUSAT-LEC-001"
            required
          />
        )}

        {role === 'student' && (
          <Input 
            label="Student ID / Enrollment Number" 
            type="text" 
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="e.g. 22CE123"
            required
          />
        )}

        <Input 
          label="Email Address" 
          type="email" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="yourname@university.edu"
          required
        />

        <Input 
          label="Password" 
          type="password" 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />

        <Input 
          label="Confirm Password" 
          type="password" 
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
          required
        />

        <Button type="submit" isLoading={loading} className="w-full mt-2">
          Sign Up
        </Button>
      </form>

      <p className="text-xs text-on-surface-variant text-center mt-2">
        Already registered?{' '}
        <Link to="/auth/login" className="text-primary font-bold hover:underline">
          Sign In Instead
        </Link>
      </p>
    </div>
  );
};

export default Register;
