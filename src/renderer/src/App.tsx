import { useState } from 'react';
import HistoryScreen from './screens/HistoryScreen';
import HomeScreen from './screens/HomeScreen';
import ProjectScreen from './screens/ProjectScreen';

type View =
  | { name: 'home' }
  | { name: 'history' }
  | { name: 'project'; projectId: string };

export default function App() {
  const [view, setView] = useState<View>({ name: 'home' });

  if (view.name === 'home') {
    return (
      <HomeScreen
        onCreateProject={async (name) => {
          const project = await window.aqian.createProject(name);
          setView({ name: 'project', projectId: project.id });
        }}
        onOpenHistory={() => setView({ name: 'history' })}
      />
    );
  }

  if (view.name === 'history') {
    return (
      <HistoryScreen
        onBack={() => setView({ name: 'home' })}
        onOpenProject={(projectId) => setView({ name: 'project', projectId })}
      />
    );
  }

  return (
    <ProjectScreen
      key={view.projectId}
      projectId={view.projectId}
      onBack={() => setView({ name: 'history' })}
    />
  );
}
