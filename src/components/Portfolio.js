import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../styles/Portfolio.css';

const Portfolio = () => {
  const { username, roomId } = useParams();
  const navigate = useNavigate();

  const handleClose = () => {
    navigate(`/${roomId}`);
  };

  return (
    <div className="portfolio-container">
      <button className="close-button" onClick={handleClose}>×</button>
      <h1>Hi {username}, Ercan Yasin Yarmaci & Muhammet Mahmut Atasever made this game</h1>
      <div className="portfolio-content">
        {/* Add your portfolio content here */}
        <section className="projects">
          <h2>Projects</h2>
          {/* Add projects */}
        </section>
        <section className="skills">
          <h2>Skills</h2>
          {/* Add skills */}
        </section>
        <section className="contact">
          <h2>Contact</h2>
          {/* Add contact info */}
        </section>
      </div>
    </div>
  );
};

export default Portfolio;
