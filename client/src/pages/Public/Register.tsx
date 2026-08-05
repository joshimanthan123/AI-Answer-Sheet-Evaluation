import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import Input from '../../components/ui/Input';
import Dropdown from '../../components/ui/Dropdown';
import Button from '../../components/ui/Button';

export const Register: React.FC = () => {
  const { register } = useAuth();
  const { addToast } = useNotifications();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'student' | 'faculty' | 'admin'>('student');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;
    setLoading(true);
    try {
      const user = await register(name, email, role);
      addToast(`Account created for ${user.name}!`, 'success');
      navigate(`/${user.role}`);
    } catch (err) {
      addToast('Registration issue', 'error');
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

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input 
          label="Full Name" 
          type="text" 
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Professor or Student Name"
          required
        />
        <Input 
          label="Email Address" 
          type="email" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="yourname@university.edu"
          required
        />
        <Dropdown 
          label="Institutional Role" 
          options={roleOptions} 
          value={role}
          onChange={(e) => setRole(e.target.value as any)}
        />
        <Button type="submit" isLoading={loading} className="w-full">
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
