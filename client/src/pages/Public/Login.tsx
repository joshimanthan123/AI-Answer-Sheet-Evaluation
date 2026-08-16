import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export const Login: React.FC = () => {
  const { login, isAuthenticated, user } = useAuth();
  const { addToast } = useNotifications();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(`/${user.role}`, { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide correct credentials.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      addToast(`Logged in successfully as ${user.name}`, 'success');
      navigate(`/${user.role}`);
    } catch (err: any) {
      setError(err?.message || 'Login details are incorrect.');
      addToast('Credentials unauthorized', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (role: 'student' | 'faculty' | 'admin') => {
    setLoading(true);
    let demoEmail = 'student@university.edu';
    if (role === 'faculty') demoEmail = 'faculty@university.edu';
    if (role === 'admin') demoEmail = 'admin@university.edu';
    
    try {
      const user = await login(demoEmail, 'password');
      addToast(`Simulated access as ${user.name}`, 'success');
      navigate(`/${user.role}`);
    } catch (err: any) {
      addToast('Demo route failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 text-left">
      <div>
        <h2 className="text-xl font-bold text-on-surface">Sign In to GradeAI</h2>
        <p className="text-xs text-on-surface-variant mt-1">Authenticate using academic credentials</p>
      </div>

      {error && (
        <div className="p-3 bg-error-container/30 border border-error/20 text-error rounded-xl text-xs font-semibold">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input 
          label="Email Address" 
          type="email" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="academic@university.edu"
          required
        />
        
        <div className="flex flex-col gap-1">
          <Input 
            label="Password" 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
          <Link to="/auth/forgot-password" className="self-end text-xs text-primary font-semibold hover:underline">
            Forgot Password?
          </Link>
        </div>

        <Button type="submit" isLoading={loading} className="w-full">
          Sign In
        </Button>
      </form>

      <div className="relative my-2">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-outline-variant/30" /></div>
        <div className="relative flex justify-center text-xs uppercase"><span className="bg-white dark:bg-surface-container px-2 text-outline font-bold">Or Demo Bypasses</span></div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button 
          onClick={() => handleDemoLogin('student')}
          className="px-2 py-2 bg-primary/5 hover:bg-primary/10 border border-primary/10 rounded-xl text-xs text-primary font-bold cursor-pointer transition-colors active:scale-95"
        >
          Student
        </button>
        <button 
          onClick={() => handleDemoLogin('faculty')}
          className="px-2 py-2 bg-secondary/5 hover:bg-secondary/10 border border-secondary/10 rounded-xl text-xs text-secondary font-bold cursor-pointer transition-colors active:scale-95"
        >
          Faculty
        </button>
        <button 
          onClick={() => handleDemoLogin('admin')}
          className="px-2 py-2 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 border border-red-200/50 rounded-xl text-xs text-red-700 dark:text-red-400 font-bold cursor-pointer transition-colors active:scale-95"
        >
          Admin
        </button>
      </div>

      <p className="text-xs text-on-surface-variant text-center mt-2">
        New to GradeAI?{' '}
        <Link to="/auth/register" className="text-primary font-bold hover:underline">
          Register Workspaces
        </Link>
      </p>
    </div>
  );
};

export default Login;
