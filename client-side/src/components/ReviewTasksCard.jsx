import React from 'react';
import './ReviewTasksCard.css';

// Placeholder for icons. In a real app, you'd use a library like react-icons.
const Icon = ({ children }) => <span className="icon-small">{children}</span>;

const ReviewTasksCard = () => {
  // Sample data for the tasks
  const tasks = [
    {
      id: 1,
      name: 'About Us Illustration',
      project: 'Main Project',
      dueDate: 'March 17 - 09:00AM',
      flag: 'blue',
      completed: true,
    },
    {
      id: 2,
      name: 'Hero Illustration',
      project: 'Landing Page Pro...',
      dueDate: 'March 17 - 09:00AM',
      flag: 'red',
      completed: true,
    },
    {
      id: 3,
      name: 'Moodboarding',
      project: 'Landing Page Pro...',
      dueDate: 'Add date',
      flag: 'red',
      completed: true,
    },
    {
      id: 4,
      name: 'Research',
      project: 'Yellow Branding',
      dueDate: 'March 17 - 09:00AM',
      flag: 'blue',
      completed: true,
    },
  ];

  return (
    <div className="review-tasks-card">
      <h3 className="card-title-header">To review</h3>

      <div className="tasks-table">
        {/* Table Header */}
        <div className="table-header">
          <span className="header-item name-col">Name</span>
          <span className="header-item projects-col">Projects</span>
          <span className="header-item date-col">Due Date</span>
        </div>

        {/* Task List */}
        <div className="table-body">
          {tasks.map((task) => (
            <div key={task.id} className="table-row">
              <span className="row-item name-col">
                {task.completed && <Icon>✅</Icon>} {/* Checkmark icon */}
                {task.name}
                {task.flag === 'blue' && <Icon>📘</Icon>} {/* Blue flag */}
                {task.flag === 'red' && <Icon>🚩</Icon>} {/* Red flag */}
              </span>
              <span className="row-item projects-col">{task.project}</span>
              <span className="row-item date-col">
                {task.dueDate === 'Add date' && <Icon>🗓️</Icon>}{" "}
                {/* Calendar icon for 'Add date' */}
                {task.dueDate}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ReviewTasksCard;