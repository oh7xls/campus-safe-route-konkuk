import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse'; // CSV 파싱 라이브러리 (npm install papaparse @types/papaparse)

const filePath = path.join(process.cwd(), 'GWANGJIN_SMART_LIGHT_2026.08.24-08.30.csv');

// 데이터 조회 (GET)
export async function GET() {
  try {
    const fileContent = fs.readFileSync(filePath, 'euc-kr');
    const parsed = Papa.parse(fileContent, { header: true, skipEmptyLines: true });
    return NextResponse.json(parsed.data.slice(0, 100)); // 성능을 위해 상위 100개 리턴 예시
  } catch (error) {
    return NextResponse.json({ error: '데이터를 읽어오지 못했습니다.' }, { status: 500 });
  }
}

// 데이터 수정 (PUT)
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { 시리얼, 수정할필드명, 수정할값 } = body;

    const fileContent = fs.readFileSync(filePath, 'euc-kr');
    const parsed = Papa.parse(fileContent, { header: true, skipEmptyLines: true });
    
    let updated = false;
    const newData = parsed.data.map((row: any) => {
      if (row['시리얼'] === 시리얼) {
        row[수정할필드명] = 수정할값;
        updated = true;
      }
      return row;
    });

    if (!updated) {
      return NextResponse.json({ error: '해당 시리얼 번호를 가진 보안등을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 다시 CSV로 변환 후 저장 (EUC-KR 인코딩 고려)
    const csv = Papa.unparse(newData);
    // 한글 깨짐 방지를 위해 iconv-lite 등을 활용해 euc-kr로 변환 저장 가능
    fs.writeFileSync(filePath, Buffer.from('\uFEFF' + csv, 'utf-8')); // 혹은 euc-kr 인코딩 처리

    return NextResponse.json({ success: true, message: '데이터가 수정되었습니다.' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '데이터 수정 중 오류가 발생했습니다.' }, { status: 500 });
  }
}