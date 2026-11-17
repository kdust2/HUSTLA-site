import { Sparkles } from 'lucide-react';
import { useScrollReveal } from '@/lib/motion';
import { AppShell, Header } from '@/components/layout';
import { CampaignIntegrity } from '@/components/shared';

export function CreatorsPage() {
  useScrollReveal();
  return (
    <AppShell title="Creators">
      <Header eyebrow="FOR CREATORS" title="Promote your work. Earn from others." description="Musicians, creators and freelancers can run campaigns for their own work and complete tasks for others — from one account." />
      <>
        <div className="simple-grid reveal">{[['Promote your own work', 'Put real outreach and original promotional content behind your profile, channel, release or show. Nothing bought, nothing faked.'], ['Earn through your skills', 'Edit, design, shoot, write or test for businesses and fellow creators — and build a track record people can see.']].map(([title, copy]) => <div className="info-panel" key={title}><Sparkles color="#2455d6" /><h3>{title}</h3><p>{copy}</p></div>)}</div>
        <section className="sec reveal"><h2 className="display">Good work gets noticed.</h2><p className="auth-caption">Performance is measured on approved work, on-time delivery and quality — never follower counts. You decide what appears on your profile.</p><div className="task-list" style={{ marginTop: 18 }}>{[['Efua Mensah','Video editor','48 approved jobs · 4.9 rating','Top Performer'],['Kwame Asante','Photographer','41 approved jobs · 4.9 rating','Reliable Partner'],['Abena Owusu','Graphic designer','33 approved jobs · 4.8 rating','Creative Pro']].map(([name, role, details, badge], index) => <div className="task-card" key={name}><div className="avatar">{name.split(' ').map((word) => word[0]).join('')}</div><div className="task-info"><h3>{index + 1}. {name}</h3><p>{role} · {details}</p></div><span className="category">{badge}</span></div>)}</div><CampaignIntegrity /></section>
      </>
    </AppShell>
  );
}
