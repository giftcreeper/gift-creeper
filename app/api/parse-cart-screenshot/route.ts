import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { imagesBase64 } = await req.json();
    if (!imagesBase64 || !Array.isArray(imagesBase64) || imagesBase64.length === 0) {
      return NextResponse.json({ error: '未提供有效的圖片資料陣列' }, { status: 400 });
    }

    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      console.error('缺少 DASHSCOPE_API_KEY');
      return NextResponse.json({ error: '伺服器未設定 DASHSCOPE_API_KEY 環境變數' }, { status: 500 });
    }

    // 並列處理多張圖片
    const parsePromises = imagesBase64.map(async (imageBase64: string) => {
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
                  text: '分析這張購物車截圖，精確提取所有商品。要求：\n1. product_name 必須高度精簡，只保留最核心的商品名稱，徹底去除非必要的修飾詞、行銷詞、SEO關鍵字與符號。\n2. 提取單價 price 與數量 quantity。\n3. 規格 spec 提取顏色或尺寸說明，【嚴禁包含「颜色分类：」、「顏色分類：」或「規格：」等前綴文字】，直接輸出純規格內容。\n嚴格僅輸出合法 JSON 格式：{"items":[{"product_name": string, "price": number, "quantity": number, "spec": string}]}'
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
      if (!response.ok) return [];

      const contentText = data.choices?.[0]?.message?.content;
      if (!contentText) return [];

      try {
        const parsedData = JSON.parse(contentText);
        return parsedData.items || [];
      } catch (e) {
        return [];
      }
    });

    const results = await Promise.all(parsePromises);
    // 將多張圖解析出來的商品合併為單一陣列
    const allItems = results.flat();

    return NextResponse.json({ success: true, items: allItems });
  } catch (error: any) {
    console.error('Qwen-VL 解析發生例外:', error);
    return NextResponse.json({ error: error.message || '購物車截圖解析失敗' }, { status: 500 });
  }
}