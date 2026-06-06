"""OCR 파이프라인 단독 실행/테스트 스크립트.

서버·DB·프론트 없이 영수증 이미지 한 장을 바로 인식해 결과를 출력한다.
제안서 성공 기준(신뢰도 >= 0.85, 응답 <= 10초)을 빠르게 확인하는 용도.

사용법 (backend 폴더에서):
    python scripts/run_ocr.py <영수증_이미지_경로>
예:
    python scripts/run_ocr.py samples/receipt1.jpg
"""
import json
import sys
from pathlib import Path

# 'app' 패키지를 import 할 수 있도록 backend 폴더를 경로에 추가
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services import ocr_service  # noqa: E402


def main():
    if len(sys.argv) < 2:
        print("사용법: python scripts/run_ocr.py <영수증_이미지_경로>")
        sys.exit(1)

    path = Path(sys.argv[1])
    if not path.exists():
        print(f"파일을 찾을 수 없습니다: {path}")
        sys.exit(1)

    image_bytes = path.read_bytes()
    result = ocr_service.recognize_receipt(image_bytes)

    print("\n===== OCR 인식 결과 =====")
    print(json.dumps(result, ensure_ascii=False, indent=2))

    # 성공 기준 간단 체크
    print("\n===== 성공 기준 체크 =====")
    print(f"신뢰도 {result['confidence']} (>= 0.85 목표): "
          f"{'PASS' if result['confidence'] >= 0.85 else 'FAIL'}")
    print(f"응답시간 {result['elapsed_sec']}초 (<= 10초 목표): "
          f"{'PASS' if result['elapsed_sec'] <= 10 else 'FAIL'}")


if __name__ == "__main__":
    main()
