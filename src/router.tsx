import { createBrowserRouter, Navigate } from 'react-router';
import { App } from './App';
import { TodayScreen } from './routes/today/TodayScreen';
import { WeeklyScreen } from './routes/weekly/WeeklyScreen';
import { GoalsScreen } from './routes/goals/GoalsScreen';
import { TargetDetailScreen } from './routes/goals/TargetDetailScreen';
import { InsightsScreen } from './routes/insights/InsightsScreen';

// Each tab is a real URL, so the phone's back button works and screens can be bookmarked.
export const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/today" replace /> },
      { path: 'today', element: <TodayScreen />, handle: { title: 'Today' } },
      { path: 'weekly', element: <WeeklyScreen />, handle: { title: 'Weekly' } },
      { path: 'goals', element: <GoalsScreen />, handle: { title: 'Goals' } },
      { path: 'goals/new', element: <TargetDetailScreen />, handle: { title: 'Goals' } },
      { path: 'goals/:targetId', element: <TargetDetailScreen />, handle: { title: 'Goals' } },
      { path: 'insights', element: <InsightsScreen />, handle: { title: 'Insights' } },
      { path: '*', element: <Navigate to="/today" replace /> },
    ],
  },
]);
