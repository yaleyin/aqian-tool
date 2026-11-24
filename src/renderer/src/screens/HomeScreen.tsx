import { History, Plus } from 'lucide-react';
import { useState } from 'react';
import NewProjectModal from './NewProjectModal';

export interface HomeScreenProps {
  onCreateProject: (name: string) => Promise<void>;
  onOpenHistory: () => void;
}

export default function HomeScreen({ onCreateProject, onOpenHistory }: HomeScreenProps) {
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  return (
    <main className="app-shell">
      <header className="home-hero">
        <div className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p className="eyebrow">出行分摊账本</p>
        <h1>A钱小工具</h1>
        <p className="home-subtitle">把每一次出行的花销，算得明明白白。</p>
      </header>

      <section className="home-actions" aria-label="开始使用">
        <button
          type="button"
          className="home-action primary"
          aria-label="新建消费项目"
          onClick={() => setNewProjectOpen(true)}
        >
          <span className="home-action-icon" aria-hidden="true">
            <Plus size={24} />
          </span>
          <span className="home-action-kicker">从零开始</span>
          <strong>新建消费项目</strong>
          <span>记录人员、活动和每一笔分摊</span>
        </button>
        <button
          type="button"
          className="home-action"
          aria-label="历史消费项目"
          onClick={onOpenHistory}
        >
          <span className="home-action-icon" aria-hidden="true">
            <History size={24} />
          </span>
          <span className="home-action-kicker">继续算账</span>
          <strong>历史消费项目</strong>
          <span>打开之前保存的项目继续编辑</span>
        </button>
      </section>

      <p className="home-footnote">所有数据只保存在这台电脑上，不会上传到网络。</p>

      <NewProjectModal
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        onCreate={onCreateProject}
      />
    </main>
  );
}
