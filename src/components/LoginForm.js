import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

const LoginForm = () => {
  const [username, setUsername] = useState('');
  const [selectedColor, setSelectedColor] = useState('#0000ff');
  const [roomId, setRoomId] = useState('');
  const navigate = useNavigate();
  const { t, language, toggleLanguage } = useLanguage();
  const translatedText = t('keyName');

  const handleSubmit = (e, isRandom = false) => {
    e.preventDefault();
    if (!username.trim()) return;

    if (isRandom) {
      // Generate random 8-digit room ID
      const randomRoomId = Math.floor(10000000 + Math.random() * 90000000).toString();
      localStorage.setItem('gameUserData', JSON.stringify({ username, selectedColor }));
      navigate(`/${randomRoomId}`);
    } else if (roomId.length === 8 && /^\d+$/.test(roomId)) {
      localStorage.setItem('gameUserData', JSON.stringify({ username, selectedColor }));
      navigate(`/${roomId}`);
    } else {
      alert('Please enter a valid 8-digit room ID');
    }
  };

  const renderLanguageButton = () => {
    return (
      <button
        className="language-button"
        onClick={toggleLanguage}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          padding: '8px 16px',
          background: 'rgba(93, 64, 55, 0.8)',
          border: '2px solid #3e2723',
          color: 'white',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px'
        }}
      >
        {language === 'en' ? 'TR' : 'EN'}
      </button>
    );
  };

  return (
    <div className="login-form">
      {renderLanguageButton()}
      <h2>{t('login')}</h2>
      <input
        type="text"
        placeholder={t('username')}
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <input
        type="color"
        value={selectedColor}
        onChange={(e) => setSelectedColor(e.target.value)}
      />
      <div className="room-options">
        <button 
          onClick={(e) => handleSubmit(e, true)}
          disabled={!username.trim()}
        >
          {t('joinRandom')}
        </button>
        <div className="room-search">
          <input
            type="text"
            placeholder={t('enterRoomId')}
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            pattern="[0-9]{8}"
          />
          <button 
            onClick={(e) => handleSubmit(e, false)}
            disabled={!username.trim() || roomId.length !== 8}
          >
            {t('joinRoom')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
