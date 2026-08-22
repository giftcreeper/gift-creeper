import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { imageBase64 } = await req.json();
    if (!imageBase64) {
      return NextResponse.json({ error: '未提供圖片資料' }, { status: 400 });
    }

    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      console.error('缺少 DASHSCOPE_API_KEY');
      return NextResponse.json({ error: '伺服器未設定 DASHSCOPE_API_KEY 環境變數' }, { status: 500 });
    }

    // 呼叫 Qwen-VL (DashScope 兼容接口)
    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen-vl-max',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: '分析這張購物車截圖，精確提取所有商品。要求：\n1. product_name 必須【高度精簡】，只保留最核心的商品名稱（例如將「2026新款爆款包郵韓版大容量帆布袋網紅同款」精簡為「大容量帆布袋」），徹底去除非必要的修飾詞、行銷詞、SEO關鍵字與符號。\n2. 提取單價 price 與數量 quantity。\n3. 規格 spec 提取顏色、尺寸等簡短說明。\n嚴格僅輸出合法 JSON 格式：{"items":[{"product_name": string, "price": number, "quantity": number, "spec": string}]}'
              },
              {
                type: 'image_url',
                image_url: { url: imageBase64 }
              }
            ]
          }
        ],
        response_format: { type: "json_object" }
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('DashScope API 錯誤回應:', data);
      return NextResponse.json({ error: data.error?.message || data.message || 'AI 辨識服務回應失敗' }, { status: response.status });
    }

    const contentText = data.choices?.[0]?.message?.content;
    if (!contentText) {
      return NextResponse.json({ error: 'AI 未能回傳有效數據' }, { status: 500 });
    }

    const parsedData = JSON.parse(contentText);
    return NextResponse.json({ success: true, items: parsedData.items || [] });
  } catch (error: any) {
    console.error('Qwen-VL 解析發生例外:', error);
    return NextResponse.json({ error: error.message || '購物車截圖解析失敗' }, { status: 500 });
  }
}