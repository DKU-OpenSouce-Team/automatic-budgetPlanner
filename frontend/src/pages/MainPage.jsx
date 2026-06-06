import { Link } from "react-router-dom";

const summaryCards = [
  { label: "이번 달 지출", value: "620,000원", icon: "💸", color: "bg-red-50 border-red-200" },
  { label: "등록된 영수증", value: "12장", icon: "🧾", color: "bg-blue-50 border-blue-200" },
  { label: "절약 목표 달성", value: "68%", icon: "🎯", color: "bg-green-50 border-green-200" },
];

const recentTransactions = [
  { id: 1, name: "스타벅스", category: "식비", amount: -6500, date: "2026.06.07" },
  { id: 2, name: "지하철", category: "교통", amount: -1500, date: "2026.06.07" },
  { id: 3, name: "마트", category: "식비", amount: -32000, date: "2026.06.06" },
  { id: 4, name: "월급", category: "수입", amount: 3000000, date: "2026.06.05" },
];

const quickMenus = [
  { label: "영수증 등록", path: "/upload", icon: "📷" },
  { label: "지출 내역", path: "/transactions", icon: "📋" },
  { label: "분석 & 통계", path: "/analytics", icon: "📊" },
  { label: "나만의 파일", path: "/files", icon: "📁" },
];

export default function MainPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">안녕하세요 👋</h1>
        <p className="text-gray-500 text-sm mt-1">오늘도 똑똑한 소비 생활 시작해볼까요?</p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4">
        {summaryCards.map(({ label, value, icon, color }) => (
          <div key={label} className={`rounded-xl p-4 border ${color}`}>
            <div className="text-2xl mb-2">{icon}</div>
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-xl font-bold text-gray-800 mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* 빠른 메뉴 */}
      <div className="bg-white rounded-xl p-5 shadow-sm border">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">빠른 메뉴</h2>
        <div className="grid grid-cols-4 gap-3">
          {quickMenus.map(({ label, path, icon }) => (
            <Link
              key={path}
              to={path}
              className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <span className="text-3xl">{icon}</span>
              <span className="text-xs text-gray-600 text-center">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* 최근 거래 내역 */}
      <div className="bg-white rounded-xl p-5 shadow-sm border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-700">최근 거래 내역</h2>
          <Link to="/transactions" className="text-sm text-indigo-600 hover:underline">
            전체보기
          </Link>
        </div>
        <div className="space-y-3">
          {recentTransactions.map(({ id, name, category, amount, date }) => (
            <div key={id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-800">{name}</p>
                <p className="text-xs text-gray-400">{category} · {date}</p>
              </div>
              <span
                className={`text-sm font-semibold ${
                  amount > 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                {amount > 0 ? "+" : ""}
                {amount.toLocaleString()}원
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}