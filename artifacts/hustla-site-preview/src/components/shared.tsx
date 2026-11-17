

export function NumberedSteps({ items }: { items: string[][] }) {
  return <ol className="number-list">{items.map(([title, description], index) => <li key={title}><span className="number">{index + 1}</span><div><b>{title}</b><span>{description}</span></div></li>)}</ol>;
}

export function CampaignIntegrity() {
  return <div className="notice"><strong>No fake engagement. Ever.</strong> HUSTLA does not sell followers, likes, comments, views, artificial streams or paid reviews. Every campaign is reviewed by a person before anyone can see it.</div>;
}
