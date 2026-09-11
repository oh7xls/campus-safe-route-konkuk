'use client';

import { useState } from 'ckelient'; // 'use client'

export default function LightAdminPage() {
  const [serial, setSerial] = useState('');
  const [field, setField] = useState('현재디밍값(%)');
  const [value, setValue] = useState('');
  const [message, setMessage] = useState('');

  const handleUpdate = async () => {
    const res = await fetch('/api/lights', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 시리얼: serial, 수정할필드명: field, 수정할값: value }),
    });

    const result = await res.json();
    if (res.ok) {
      setMessage('성공적으로 수정되었습니다!');
    } else {
      setMessage(`에러: ${result.error}`);
    }
  };

  return (
    <div className="p-6 max-w-lg mx-auto space-y-4">
      <h1 className="text-xl font-bold">스마트보안등 데이터 수정 관리자</h1>
      
      <div className="flex flex-col gap-2">
        <label>시리얼 번호 (modem_no)</label>
        <input 
          type="text" 
          value={serial} 
          onChange={(e) => setSerial(e.target.value)} 
          className="border p-2 rounded" 
          placeholder="예: 019010d0002000b"
        />

        <label>수정할 항목</label>
        <select value={field} onChange={(e) => setField(e.target.value)} className="border p-2 rounded">
          <option value="현재디밍값(%)">현재디밍값(%)</option>
          <option value="현재전력값(W)">현재전력값(W)</option>
          <option value="램프고장(정상:0, 고장:1)">램프고장 상태</option>
        </select>

        <label>변경할 값</label>
        <input 
          type="text" 
          value={value} 
          onChange={(e) => setValue(e.target.value)} 
          className="border p-2 rounded" 
        />

        <button 
          onClick={handleUpdate} 
          className="bg-blue-600 text-white p-2 rounded mt-2 hover:bg-blue-700"
        >
          데이터 수정 반영하기
        </button>

        {message && <p className="text-sm font-semibold text-green-600 mt-2">{message}</p>}
      </div>
    </div>
  );
}