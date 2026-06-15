/**
 * 회원 탈퇴 버튼. 클릭 시 확인창을 거쳐 POST /auth/delete 로 제출한다.
 */

'use client';

export function DeleteAccountButton() {
  return (
    <form
      action="/auth/delete"
      method="post"
      onSubmit={(e) => {
        if (
          !window.confirm(
            '정말 탈퇴하시겠어요?\n\n계정과 프로필 정보가 삭제되며 되돌릴 수 없습니다.',
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="text-[13px] text-red-400/80 underline transition hover:text-red-400"
      >
        회원 탈퇴
      </button>
    </form>
  );
}
