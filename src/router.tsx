import { createBrowserRouter, Navigate } from 'react-router';
import { App } from './App';
import { TodayScreen } from './routes/today/TodayScreen';
import { WeeklyScreen } from './routes/weekly/WeeklyScreen';
import { GoalsScreen } from './routes/goals/GoalsScreen';
import { RoutineScreen } from './routes/goals/RoutineScreen';
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
      { path: 'goals', element: <GoalsScreen />, handle: { title: 'Habits' } },
      { path: 'goals/new', element: <TargetDetailScreen />, handle: { title: 'Habits' } },
      { path: 'goals/routine/new', element: <RoutineScreen />, handle: { title: 'Habits' } },
      { path: 'goals/routine/:routineId', element: <RoutineScreen />, handle: { title: 'Habits' } },
      { path: 'goals/:targetId', element: <TargetDetailScreen />, handle: { title: 'Habits' } },
      { path: 'insights', element: <InsightsScreen />, handle: { title: 'Insights' } },
      { path: '*', element: <Navigate to="/today" replace /> },
    ],
  },
]);
