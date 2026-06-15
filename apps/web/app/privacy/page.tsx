/**
 * 개인정보처리방침. 실제 수집 항목(카카오 소셜 로그인) 기준으로 작성.
 * ⚠️ 표준 템플릿 기반 초안 — 정식 서비스 전 법률 검토 권장.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { HomeHeader } from '../../components/home/Header';
import { LEGAL } from '../../lib/legal';

export const metadata: Metadata = {
  title: '개인정보처리방침',
  description: `${LEGAL.serviceName} 개인정보처리방침`,
  robots: { index: true, follow: false },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-[15px] font-semibold text-paper">{title}</h2>
      <div className="mt-2 space-y-2 text-[14px] leading-relaxed text-paper/75">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-ink-900 font-sans text-paper">
      <HomeHeader />
      <main className="mx-auto max-w-3xl px-6 py-12 sm:px-10">
        <h1 className="text-2xl font-bold text-paper">개인정보처리방침</h1>
        <p className="mt-2 text-[13px] text-paper/50">시행일: {LEGAL.effectiveDate}</p>

        <p className="mt-6 text-[14px] leading-relaxed text-paper/75">
          {LEGAL.serviceName}(이하 ‘서비스’)는 이용자의 개인정보를 중요하게 생각하며,
          「개인정보 보호법」 등 관련 법령을 준수합니다. 본 방침은 서비스가 어떤 개인정보를
          수집·이용하며, 이를 어떻게 보호하는지를 안내합니다.
        </p>

        <Section title="1. 수집하는 개인정보 항목">
          <p>서비스는 카카오 소셜 로그인을 통해 회원가입·로그인 시 다음 정보를 수집합니다.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>필수: 카카오계정 이메일, 닉네임, 프로필 이미지, 회원 고유식별자(카카오 회원번호 및 인증 식별자)</li>
            <li>서비스 이용 과정에서 자동 생성·수집: 접속 로그, 쿠키, 서비스 이용 기록</li>
          </ul>
          <p>
            향후 이용자가 사진·글 등을 직접 게시하는 기능을 이용할 경우, 해당 게시물 및 작성
            정보가 추가로 수집될 수 있으며 이는 별도로 고지합니다.
          </p>
        </Section>

        <Section title="2. 개인정보의 수집·이용 목적">
          <ul className="list-disc space-y-1 pl-5">
            <li>회원 식별 및 가입·로그인 상태 유지</li>
            <li>서비스 제공 및 향후 게시물 작성자 식별</li>
            <li>문의 대응 및 공지 전달</li>
            <li>부정 이용 방지 및 서비스 운영·개선</li>
          </ul>
        </Section>

        <Section title="3. 개인정보의 보유 및 이용 기간">
          <p>
            원칙적으로 회원 탈퇴 시까지 보유하며, 탈퇴 시 지체 없이 파기합니다. 다만 관련 법령에
            따라 보존이 필요한 경우 해당 기간 동안 보관합니다.
          </p>
        </Section>

        <Section title="4. 개인정보 처리의 위탁">
          <p>서비스는 원활한 운영을 위해 다음과 같이 개인정보 처리를 위탁하고 있습니다.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Supabase, Inc. — 회원 인증 및 데이터베이스 호스팅(데이터는 AWS 클라우드에 보관)</li>
            <li>주식회사 카카오 — 소셜 로그인(본인 확인) 처리</li>
          </ul>
          <p>
            Supabase, Inc.는 국외 사업자로서, 본 위탁에는 개인정보의 국외 처리가 포함될 수
            있습니다. 이용자는 본 방침을 통해 이에 동의한 것으로 봅니다.
          </p>
        </Section>

        <Section title="5. 개인정보의 제3자 제공">
          <p>서비스는 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만 법령에 따라 요구되는 경우는 예외로 합니다.</p>
        </Section>

        <Section title="6. 이용자의 권리와 행사 방법">
          <p>이용자는 언제든지 다음 권리를 행사할 수 있습니다.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>개인정보 열람·정정·삭제·처리정지 요구</li>
            <li>회원 탈퇴(계정 및 개인정보 삭제) — 서비스 내 ‘계정’ 메뉴 또는 아래 연락처로 요청</li>
          </ul>
        </Section>

        <Section title="7. 개인정보의 파기">
          <p>
            보유 기간이 경과하거나 처리 목적이 달성된 경우 지체 없이 파기합니다. 전자적 파일은
            복구 불가능한 방법으로 삭제합니다.
          </p>
        </Section>

        <Section title="8. 쿠키의 사용">
          <p>
            서비스는 로그인 상태 유지를 위해 쿠키를 사용합니다. 이용자는 브라우저 설정을 통해
            쿠키 저장을 거부할 수 있으나, 이 경우 로그인 등 일부 기능이 제한될 수 있습니다.
          </p>
        </Section>

        <Section title="9. 개인정보 보호책임자 및 문의처">
          <ul className="list-disc space-y-1 pl-5">
            <li>운영 주체: {LEGAL.operator}</li>
            <li>
              문의: <a className="underline" href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>
            </li>
          </ul>
        </Section>

        <Section title="10. 고지의 의무">
          <p>
            본 방침의 내용 추가·삭제·수정이 있을 경우 시행 전 서비스 내 공지를 통해 알립니다.
          </p>
        </Section>

        <div className="mt-10 border-t border-paper/10 pt-6 text-[13px] text-paper/50">
          <Link href="/terms" className="underline hover:text-paper/80">이용약관 보기</Link>
        </div>
      </main>
    </div>
  );
}
