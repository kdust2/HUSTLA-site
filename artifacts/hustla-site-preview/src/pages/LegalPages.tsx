import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { Brand } from '@/components/layout';
import { LegalLinks } from '@/components/LegalLinks';

// Edit these two lines to match the registered business details.
const COMPANY = 'HUSTLA';
const CONTACT = 'the support contact shown on the Help page';
const UPDATED = '21 November 2026';

function LegalLayout({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <div className="site legal-site">
      <header className="public-header">
        <Brand />
        <div className="public-actions"><Link className="btn" href="/" data-testid="link-legal-home">Back to HUSTLA</Link></div>
      </header>
      <main className="legal">
        <p className="eyebrow">Last updated {UPDATED}</p>
        <h1>{title}</h1>
        <p className="legal-intro">{intro}</p>
        {children}
        <LegalLinks className="legal-bottom" />
      </main>
    </div>
  );
}

function S({ h, children }: { h: string; children: ReactNode }) {
  return <section><h2>{h}</h2>{children}</section>;
}

export function TermsPage() {
  return (
    <LegalLayout title="Terms of use" intro={`These terms explain how ${COMPANY} works and what we expect from everyone who uses it. By creating an account you agree to them.`}>
      <S h="1. What HUSTLA is">
        <p>{COMPANY} is a marketplace in Ghana. Campaign Publishers post paid tasks, and Task Workers apply for them and get paid in Ghana cedis (GH₵) when the work is approved. {COMPANY} provides the platform, the wallet and the review process. We are not the employer of any worker, and workers are not our employees. A publisher and a worker agree the task between themselves on the terms of the campaign brief.</p>
      </S>
      <S h="2. Your account">
        <ul>
          <li>You need to be 18 or older, or of full age where you live, to create an account.</li>
          <li>One person, one account. The same account can work as a Campaign Publisher and as a Task Worker.</li>
          <li>Give accurate details and keep your password private. You are responsible for what happens on your account.</li>
          <li>We may pause or close an account that breaks these terms or puts other members or their money at risk.</li>
        </ul>
      </S>
      <S h="3. Membership">
        <p>Membership is billed monthly only, with no free plan and no yearly package. Task Workers pay GH₵20 a month to find and apply for tasks. Campaign Publishers pay GH₵30 a month to create and manage campaigns. All members of the same type get the same access.</p>
      </S>
      <S h="4. Campaigns">
        <ul>
          <li>Each campaign must clearly state the task, what must be delivered, the quantity, the reward, the deadline and how the work will be judged.</li>
          <li>A publisher must fund a campaign before any work begins. The money is reserved for that campaign until each task is resolved.</li>
          <li>{COMPANY} reviews every campaign, usually within 24 hours, before anyone can see it. We may approve it, decline it with a reason, or ask for changes.</li>
          <li>The campaign category is chosen honestly. A campaign cannot be relabelled or placed in another category to avoid these rules.</li>
        </ul>
      </S>
      <S h="5. What is not allowed">
        <p>We do not accept, publish or approve campaigns for any of the following, and there are no exceptions:</p>
        <ul>
          <li>Fake engagement, such as buying or swapping followers, likes, comments, views or subscribers, and artificial streaming.</li>
          <li>Fake or paid positive reviews and testimonials.</li>
          <li>Fraud and scams, including money-doubling schemes, phishing and impersonation.</li>
          <li>Illegal products or services, counterfeit goods, adult or sexual content, and anything involving or targeting children.</li>
          <li>Gambling and betting, alcohol and age-restricted products, cryptocurrency, loans, investments and other financial offers.</li>
          <li>Health and medical claims, supplements and treatments.</li>
          <li>Political or election campaigns, contests and giveaways, job recruitment and work-from-home offers.</li>
          <li>Hate, harassment, cybercrime, misuse of personal data, academic dishonesty and misleading advertising.</li>
        </ul>
      </S>
      <S h="6. Applying, doing and approving work">
        <ul>
          <li>A publisher has 24 hours to accept or decline an application. If they do nothing, the application expires. Once accepted, the scope, reward and deadline are fixed unless both sides agree to change them.</li>
          <li>The worker delivers by the deadline in the brief, with genuine, original work and truthful evidence.</li>
          <li>The publisher has 48 hours to approve the work, ask for one correction, or open a dispute. If the publisher does nothing and there is no dispute or hold, the work is approved automatically.</li>
          <li>One correction round is included. The request must say exactly what is missing and must stay within the original brief. The worker then has 48 hours to resubmit, and the publisher has 24 hours to approve or open a dispute.</li>
        </ul>
      </S>
      <S h="7. Money">
        <ul>
          <li>{COMPANY}&rsquo;s fee is 10% of the task reward. It is paid by the publisher on top of the reward. It is never taken out of the worker&rsquo;s agreed reward. For a GH₵100 task, the publisher funds GH₵110 and the worker receives GH₵100.</li>
          <li>The minimum deposit is GH₵50 and the minimum withdrawal is GH₵20.</li>
          <li>Only approved and cleared earnings can be withdrawn. Money that is pending, in a dispute, or under a fraud or policy hold cannot be withdrawn until it is resolved.</li>
          <li>Withdrawals are paid on Tuesdays and Fridays to a verified mobile money number. A request made before 12:00 noon on the Monday goes out on Tuesday, and before 12:00 noon on the Thursday goes out on Friday (Ghana time). Processing depends on verification and on the payment provider.</li>
          <li>Any charge made by a payment provider is shown to you before you confirm, and never silently reduces an agreed reward.</li>
          <li>Every deposit, fee, reservation, release, refund and withdrawal is recorded in your wallet history.</li>
        </ul>
      </S>
      <S h="8. Disputes and cancellations">
        <p>Either side can open a dispute with a reason and evidence. The money for that task is held straight away and we aim to decide within 3 business days. We may release the money to the worker, refund the publisher, or split it fairly. Our decision is based on the campaign brief, the submissions and the evidence. Cancellation and refund rules are in the <Link href="/refunds">Refund policy</Link>.</p>
      </S>
      <S h="9. Rules of conduct">
        <p>Do not create fake accounts, submit fabricated or copied work, manipulate other platforms&rsquo; numbers, harass anyone, or try to get around our rules or security. We may pause a task and its money while we investigate. Serious or repeated breaches can lead to account closure.</p>
      </S>
      <S h="10. Work and ownership">
        <p>Workers confirm that what they deliver is their own original work. Unless the brief says otherwise, once a task is approved and paid the publisher may use the deliverable for the purpose of the campaign. Workers keep any rights the brief does not pass on.</p>
      </S>
      <S h="11. Our responsibility">
        <p>We work to keep {COMPANY} available and accurate, but we cannot promise it will always be uninterrupted or error-free. We are not responsible for what happens on other platforms such as social networks, or for losses that were not reasonably foreseeable. Nothing in these terms limits any right you have under Ghanaian law that cannot be limited.</p>
      </S>
      <S h="12. Changes and law">
        <p>If we change these terms in a way that matters, we will tell members before it takes effect. Continuing to use {COMPANY} after that means you accept the new terms. These terms are governed by the laws of the Republic of Ghana. Questions can be sent through {CONTACT}.</p>
      </S>
    </LegalLayout>
  );
}

export function PrivacyPage() {
  return (
    <LegalLayout title="Privacy policy" intro={`This policy explains what personal information ${COMPANY} collects, why, and what your rights are. We follow Ghana's Data Protection Act, 2012 (Act 843).`}>
      <S h="1. What we collect">
        <ul>
          <li><strong>Account details:</strong> your name, email address and a password. We never store your password itself, only a scrambled version that cannot be read back.</li>
          <li><strong>Marketplace activity:</strong> campaigns you publish, applications you send, work you submit and the messages and evidence you add to a dispute.</li>
          <li><strong>Wallet and payout details:</strong> your balances, transaction history, withdrawal requests, and the mobile money network, number and registered name you add.</li>
          <li><strong>Technical data:</strong> a sign-in cookie that keeps you logged in, and short-term records used to slow down repeated sign-in attempts.</li>
        </ul>
      </S>
      <S h="2. Why we use it">
        <ul>
          <li>To run your account, show your campaigns and work, and let other members see what they need to do a task with you.</li>
          <li>To hold, release and pay money correctly, and to verify your payout number before the first withdrawal.</li>
          <li>To review campaigns, handle disputes and complaints, and prevent fraud and abuse.</li>
          <li>To keep records that the law or an audit may require.</li>
        </ul>
        <p>We do not sell your personal information.</p>
      </S>
      <S h="3. Who can see it">
        <ul>
          <li>Other members see only what a task needs, such as your name on an application or a submission.</li>
          <li>The {COMPANY} team can see account, campaign, wallet and payout information when needed to run the service, check payments and resolve disputes.</li>
          <li>Our service providers process data for us. Today that means our hosting and database providers. When online payments are added, it will also include our payment provider.</li>
          <li>We may share information if the law requires it or to protect members from fraud.</li>
        </ul>
        <p>Some providers store data outside Ghana. We choose providers with strong security practices.</p>
      </S>
      <S h="4. How long we keep it">
        <p>We keep your account information while your account is open. Money records, disputes and related evidence are kept for as long as needed to settle claims and meet legal and accounting obligations, even after an account is closed.</p>
      </S>
      <S h="5. How we protect it">
        <p>Passwords are stored in scrambled form. Sign-in uses secure cookies. Wallet records are never edited, only added to, so there is a clear history. Access to admin tools is limited to authorised staff. No system is perfectly secure, so please keep your password private and use a different one for HUSTLA.</p>
      </S>
      <S h="6. Your rights">
        <p>You can ask to see the personal information we hold about you, to correct it, and to ask us to delete it where we no longer need it. We may need to keep certain records, such as money records, as explained above. To make a request, use {CONTACT}.</p>
      </S>
      <S h="7. Cookies and storage">
        <p>We use one essential cookie to keep you signed in. We also remember your last Worker or Publisher mode on your own device. We do not use advertising cookies.</p>
      </S>
      <S h="8. Children">
        <p>{COMPANY} is for people aged 18 and over. We do not knowingly collect information from children. If you think a child has signed up, tell us and we will remove the account.</p>
      </S>
      <S h="9. Changes">
        <p>If we change this policy in a way that matters, we will tell members. The date at the top shows when it was last updated.</p>
      </S>
    </LegalLayout>
  );
}

export function RefundsPage() {
  return (
    <LegalLayout title="Refund policy" intro="This explains when money comes back to a publisher, and what is not refundable. All amounts are in Ghana cedis (GH₵).">
      <S h="1. How campaign money is held">
        <p>When a publisher creates a campaign, the full cost is reserved: each task&rsquo;s reward plus {COMPANY}&rsquo;s 10% fee, for every task in the campaign. That money stays reserved until each task is resolved. Reserved money is not spent and is not paid to anyone until work is approved.</p>
      </S>
      <S h="2. When you get your money back">
        <ul>
          <li><strong>The campaign is declined in review:</strong> the full reserved amount, including the fee, returns to your available funds.</li>
          <li><strong>You close a campaign:</strong> every task that has not been given to a worker is refunded in full, including the fee. Tasks already in progress continue.</li>
          <li><strong>A task expires or is cancelled:</strong> if the worker misses the deadline, or a correction is not resubmitted in time, the task is released. While the campaign is open, the money stays reserved for a new worker. If the campaign is closed, it is refunded.</li>
          <li><strong>A dispute is decided in your favour:</strong> the amount awarded to you, including the matching fee, returns to your available funds. A split decision is shared fairly between both sides.</li>
          <li><strong>A mistake or technical problem on our side:</strong> we correct it and return what is owed.</li>
        </ul>
      </S>
      <S h="3. What is not refundable">
        <ul>
          <li>Work that has been approved, or automatically approved after the review period, and paid to the worker. The 10% fee on that task is also not refundable.</li>
          <li>Monthly membership fees once the month has started, except where the law says otherwise.</li>
          <li>Charges made by a payment provider, where they apply. These are shown to you before you confirm.</li>
        </ul>
      </S>
      <S h="4. Getting unused funds out">
        <p>Money in your available funds can be requested back. Refunds are paid on our payout days (Tuesday and Friday) to your verified mobile money number, less any provider charge that applies. Send your request through {CONTACT}.</p>
      </S>
      <S h="5. Workers">
        <p>Worker earnings are paid out through withdrawals, not refunds. Only approved and cleared earnings can be withdrawn. See the <Link href="/terms">Terms of use</Link> for payout days and minimums.</p>
      </S>
      <S h="6. Questions">
        <p>If you think a refund is wrong, open a dispute on the task or follow the <Link href="/complaints">Complaints policy</Link>.</p>
      </S>
    </LegalLayout>
  );
}

export function ComplaintsPage() {
  return (
    <LegalLayout title="Complaints policy" intro={`We want to hear when something goes wrong, and we want to fix it fairly. This is how to raise a problem with ${COMPANY}.`}>
      <S h="1. Which route to use">
        <ul>
          <li><strong>A problem with a specific task or payment between members:</strong> open a dispute on that task. Money for it is held straight away and we aim to decide within 3 business days.</li>
          <li><strong>A campaign that breaks our rules:</strong> use the Report button on the campaign, or contact us. We review reports and remove campaigns that break the rules.</li>
          <li><strong>Anything else:</strong> a complaint about our service, a decision we made, or your account. Contact us through {CONTACT}.</li>
        </ul>
      </S>
      <S h="2. What to include">
        <p>Your name and the email on your account, what happened and when, the task or campaign involved, and any evidence such as links or screenshots. The more detail you give, the faster we can help.</p>
      </S>
      <S h="3. What happens next">
        <ul>
          <li>We aim to confirm we have your complaint within 2 business days.</li>
          <li>We look at the records, including the campaign brief, submissions, wallet history and anything you or the other member sent.</li>
          <li>We aim to give you an answer, with our reasons, within 10 business days. Complex cases can take longer, and if so we will tell you why and when to expect an answer.</li>
        </ul>
      </S>
      <S h="4. If you disagree with our answer">
        <p>You can reply within 14 days and ask for a second review by a different member of the team. If you are still not satisfied, you may use any right you have under Ghanaian law to take the matter further.</p>
      </S>
      <S h="5. Suspended accounts and appeals">
        <p>If your account or a campaign is paused or removed, we will tell you the reason. You can appeal the decision in the same way, and we will review it. While we investigate suspected fraud or a rule breach, money connected to it may be held.</p>
      </S>
      <S h="6. Fairness">
        <p>Business days exclude weekends and Ghana public holidays. Using the complaints process will never count against you.</p>
      </S>
    </LegalLayout>
  );
}
