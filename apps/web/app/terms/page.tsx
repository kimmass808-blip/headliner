/**
 * 이용약관. 공연·페스티벌 정보 서비스 + 향후 이용자 게시물(사진/글) 기준 표준 초안.
 * ⚠️ 표준 템플릿 기반 초안 — 정식 서비스 전 법률 검토 권장.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { HomeHeader } from '../../components/home/Header';
import { LEGAL } from '../../lib/legal';

export const metadata: Metadata = {
  title: '이용약관',
  description: `${LEGAL.serviceName} 이용약관`,
  robots: { index: true, follow: false },
};

function Article({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-[15px] font-semibold text-paper">{title}</h2>
      <div className="mt-2 space-y-2 text-[14px] leading-relaxed text-paper/75">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-ink-900 font-sans text-paper">
      <HomeHeader />
      <main className="mx-auto max-w-3xl px-6 py-12 sm:px-10">
        <h1 className="text-2xl font-bold text-paper">이용약관</h1>
        <p className="mt-2 text-[13px] text-paper/50">시행일: {LEGAL.effectiveDate}</p>

        <Article title="제1조 (목적)">
          <p>
            본 약관은 {LEGAL.serviceName}(이하 ‘서비스’)가 제공하는 공연·페스티벌 정보 서비스의
            이용과 관련하여 서비스와 이용자 간의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.
          </p>
        </Article>

        <Article title="제2조 (정의)">
          <ul className="list-disc space-y-1 pl-5">
            <li>‘이용자’란 본 약관에 따라 서비스를 이용하는 자를 말합니다.</li>
            <li>‘회원’이란 카카오 소셜 로그인을 통해 가입하여 서비스를 이용하는 자를 말합니다.</li>
            <li>‘게시물’이란 회원이 서비스에 게시한 사진·글 등 일체의 정보를 말합니다.</li>
          </ul>
        </Article>

        <Article title="제3조 (약관의 효력 및 변경)">
          <p>
            본 약관은 서비스 화면에 게시함으로써 효력이 발생합니다. 서비스는 관련 법령을 위반하지
            않는 범위에서 약관을 변경할 수 있으며, 변경 시 시행일과 변경 내용을 사전에 공지합니다.
          </p>
        </Article>

        <Article title="제4조 (회원가입 및 계정)">
          <p>
            이용자는 카카오 소셜 로그인을 통해 회원으로 가입하며, 본 약관 및 개인정보처리방침에
            동의함으로써 가입이 완료됩니다. 회원은 자신의 계정을 선량한 관리자의 주의로 관리해야
            합니다.
          </p>
        </Article>

        <Article title="제5조 (서비스의 내용)">
          <p>서비스는 다음을 제공합니다.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>국내 공연·페스티벌·아티스트 정보의 검색 및 열람(로그인 불요)</li>
            <li>회원의 사진·글 게시 등 기여 기능(추후 제공, 로그인 필요)</li>
          </ul>
          <p>서비스의 열람 기능은 로그인 없이 누구나 이용할 수 있습니다.</p>
        </Article>

        <Article title="제6조 (이용자의 의무)">
          <p>이용자는 다음 행위를 해서는 안 됩니다.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>타인의 권리(저작권·초상권·명예 등)를 침해하는 행위</li>
            <li>허위 정보 게시, 욕설·혐오·음란물 등 부적절한 콘텐츠 게시</li>
            <li>서비스의 정상적 운영을 방해하는 행위</li>
            <li>관련 법령 또는 본 약관을 위반하는 행위</li>
          </ul>
        </Article>

        <Article title="제7조 (게시물의 권리와 책임)">
          <p>
            회원이 게시한 게시물의 저작권은 해당 회원에게 있습니다. 회원은 서비스가 게시물을
            서비스 운영·노출 목적으로 사용하는 것을 허락합니다. 게시물에 대한 책임은 게시한
            회원에게 있으며, 서비스는 법령 또는 본 약관을 위반한 게시물을 사전 통지 없이 삭제하거나
            노출을 제한할 수 있습니다.
          </p>
        </Article>

        <Article title="제8조 (서비스의 변경 및 중단)">
          <p>
            서비스는 운영상·기술상 필요에 따라 서비스의 전부 또는 일부를 변경하거나 중단할 수
            있으며, 이 경우 가능한 범위에서 사전에 공지합니다.
          </p>
        </Article>

        <Article title="제9조 (회원 탈퇴 및 이용 제한)">
          <p>
            회원은 언제든지 서비스 내 ‘계정’ 메뉴를 통해 탈퇴할 수 있으며, 탈퇴 시 계정 및
            개인정보는 개인정보처리방침에 따라 처리됩니다. 서비스는 회원이 본 약관을 위반한 경우
            이용을 제한하거나 회원 자격을 정지·상실시킬 수 있습니다.
          </p>
        </Article>

        <Article title="제10조 (면책)">
          <p>
            서비스는 천재지변, 이용자의 귀책 등 서비스의 합리적 통제를 벗어난 사유로 인한 손해에
            대하여 책임을 지지 않습니다. 서비스가 제공하는 공연·페스티벌 정보는 정확성을 위해
            노력하나 이를 보증하지 않으며, 실제 정보는 주최 측 공지를 확인하시기 바랍니다.
          </p>
        </Article>

        <Article title="제11조 (준거법 및 관할)">
          <p>
            본 약관은 대한민국 법령에 따라 해석되며, 서비스와 이용자 간 분쟁에 관한 소송은 관련
            법령이 정하는 관할 법원에 제기합니다.
          </p>
        </Article>

        <div className="mt-10 border-t border-paper/10 pt-6 text-[13px] text-paper/50">
          <Link href="/privacy" className="underline hover:text-paper/80">개인정보처리방침 보기</Link>
          <span className="mx-2">·</span>
          문의: <a className="underline hover:text-paper/80" href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>
        </div>
      </main>
    </div>
  );
}
