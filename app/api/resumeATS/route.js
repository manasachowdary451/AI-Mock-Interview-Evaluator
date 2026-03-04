export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req) {
  try {

    // your ATS logic

    // DB persist try/catch

    return NextResponse.json({ success: true, atsResult });

  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}