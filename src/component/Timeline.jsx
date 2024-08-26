import React from "react";

const TimelineItem = ({ title, value, status }) => (
  <div className="grid grid-cols-1 p-4 rounded border border-gray-300 m-3">
    <h4 className="text-lg font-semibold">{title}</h4>
    <pre className="scrollable">
      <code>{JSON.stringify(value, null, 2)}</code>
    </pre>
    <br />
    <br />
  </div>
);

const Timeline = ({ steps }) => (
  <div className="space-y-6 p-4">
    {steps && steps.length > 0 ? (
      <div className="space-y-6 p-4">
        {steps.map((step, index) => (
          <TimelineItem
            key={index}
            title={step.title}
            value={step.value}
            status={step.status}
          />
        ))}
      </div>
    ) : (
      <div className="text-center text-gray-500">No data available</div>
    )}
  </div>
);

export default Timeline;
