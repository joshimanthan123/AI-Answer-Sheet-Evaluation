import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../../services/auth.service';
import { useNotifications } from '../../context/NotificationContext';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export const ForgotPassword: React.FC = () => {
  const { addToast } = useNotifications();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const res = await authService.forgotPassword(email);
      addToast(res.message, 'success');
      navigate('/auth/login');
    } catch (err: any) {
      addToast(err?.message || 'Error occurred.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 text-left">
      <div>
        <h2 className="text-xl font-bold text-on-surface">Forgot Password?</h2>
        <p className="text-xs text-on-surface-variant mt-1">Reset your database key credential</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input 
          label="Email Address" 
          type="email" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="yourname@university.edu"
          required
        />
        <Button type="submit" isLoading={loading} className="w-full">
          Send Reset Link
        </Button>
      </form>

      <p className="text-xs text-on-surface-variant text-center mt-2">
        Remembered password?{' '}
        <Link to="/auth/login" className="text-primary font-bold hover:underline">
          Back to Login
        </Link>
      </p>
    </div>
  );
};

export default ForgotPassword;
