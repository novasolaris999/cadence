import { createBrowserRouter, Navigate } from 'react-router';
import { App } from './App';
import { TodayScreen } from './routes/today/TodayScreen';

// Today loads with the app (it is the first screen). The other tabs load their code the first time you
// open them: a smaller first download on the phone. React Router fetches the code before switching, so
// there is no loading flash; the installed app has every piece cached after the first visit anyway.
const weekly = async () => ({ Component: (await import('./routes/weekly/WeeklyScreen')).WeeklyScreen });
const goals = async () => ({ Component: (await import('./routes/goals/GoalsScreen')).GoalsScreen });
const habit = async () => ({ Component: (await import('./routes/goals/TargetDetailScreen')).TargetDetailScreen });
const routine = async () => ({ Component: (await import('./routes/goals/RoutineScreen')).RoutineScreen });
const todo = async () => ({ Component: (await import('./routes/todo/TodoScreen')).TodoScreen });
const insights = async () => ({ Component: (await import('./routes/insights/InsightsScreen')).InsightsScreen });

// Each tab is a real URL, so the phone's back button works and screens can be bookmarked.
export const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/today" replace /> },
      { path: 'today', element: <TodayScreen />, handle: { title: 'Today' } },
      { path: 'weekly', lazy: weekly, handle: { title: 'Weekly' } },
      { path: 'goals', lazy: goals, handle: { title: 'Habits' } },
      { path: 'goals/new', lazy: habit, handle: { title: 'Habits' } },
      { path: 'goals/routine/new', lazy: routine, handle: { title: 'Habits' } },
      { path: 'goals/routine/:routineId', lazy: routine, handle: { title: 'Habits' } },
      { path: 'goals/:targetId', lazy: habit, handle: { title: 'Habits' } },
      { path: 'todo', lazy: todo, handle: { title: 'To-do' } },
      { path: 'insights', lazy: insights, handle: { title: 'Insights' } },
      { path: '*', element: <Navigate to="/today" replace /> },
    ],
  },
]);
