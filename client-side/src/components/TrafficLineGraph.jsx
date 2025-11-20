import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import './TrafficLineGraph.css';

const data = [
  { name: 'Jan', uv: 4000, pv: 2400 },
  { name: 'Feb', uv: 3000, pv: 1398 },
  { name: 'Mar', uv: 2000, pv: 9800 },
  { name: 'Apr', uv: 2780, pv: 3908 },
  { name: 'May', uv: 1890, pv: 4800 },
  { name: 'Jun', uv: 2390, pv: 3800 },
  { name: 'Jul', uv: 3490, pv: 4300 },
];

const TrafficLineGraph = () => {
  return (
    <div className="traffic-line-graph-card">
      <h3 className="card-title-header">Traffic Trend</h3>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={data}
          margin={{
            top: 20,
            right: 30,
            left: -10, // Adjust left margin for YAxis if needed
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis dataKey="name" axisLine={false} tickLine={false} stroke="#6c757d" />
          <YAxis axisLine={false} tickLine={false} stroke="#6c757d" />
          <Tooltip
            cursor={{ stroke: '#cccccc', strokeWidth: 1 }}
            contentStyle={{
              backgroundColor: 'rgba(255,255,255,0.9)',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              fontSize: '0.9rem',
            }}
            labelStyle={{ color: '#495057', fontWeight: 600 }}
            itemStyle={{ color: '#495057' }}
          />
          <Line
            type="monotone"
            dataKey="uv" /* Represents 'Unique Visitors' or similar */
            stroke="#1abc9c" /* Using our active teal color */
            strokeWidth={3}
            dot={{ r: 4 }}
            activeDot={{ r: 8, fill: '#1abc9c', stroke: '#ffffff', strokeWidth: 2 }}
          />
          {/* You can add a second line if 'pv' (page views) is also tracked */}
          {/* <Line type="monotone" dataKey="pv" stroke="#8884d8" strokeWidth={2} dot={false} /> */}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TrafficLineGraph;