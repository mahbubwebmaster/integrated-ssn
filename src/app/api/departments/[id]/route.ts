import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { success: false, error: "শুধুমাত্র সুপার অ্যাডমিন দপ্তরের তথ্য সম্পাদনা করতে পারবেন" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { nameBn, nameEn, name } = body;

    const existingDept = await prisma.department.findUnique({
      where: { id },
    });

    if (!existingDept) {
      return NextResponse.json(
        { success: false, error: "দপ্তর পাওয়া যায়নি (Department not found)" },
        { status: 404 }
      );
    }

    const cleanNameBn = nameBn !== undefined ? (nameBn ? String(nameBn).trim() : null) : existingDept.nameBn;
    const cleanNameEn = nameEn !== undefined ? (nameEn ? String(nameEn).trim() : null) : existingDept.nameEn;
    const cleanRaw = name !== undefined && name.trim() ? String(name).trim() : (cleanNameEn || cleanNameBn || existingDept.name);

    const updated = await prisma.department.update({
      where: { id },
      data: {
        name: cleanRaw,
        nameBn: cleanNameBn,
        nameEn: cleanNameEn,
      },
    });

    return NextResponse.json({ success: true, department: updated });
  } catch (error: unknown) {
    console.error("Failed to update department:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { success: false, error: "শুধুমাত্র সুপার অ্যাডমিন দপ্তর মুছতে পারবেন" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const schemeCount = await prisma.scheme.count({
      where: { departmentId: id },
    });

    if (schemeCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "এই দপ্তরের আওতায় সক্রিয় সামাজিক নিরাপত্তা কর্মসূচি রয়েছে। প্রথমে কর্মসূচিগুলো স্থানান্তর বা মুছতে হবে।",
        },
        { status: 400 }
      );
    }

    const userCount = await prisma.user.count({
      where: { departmentId: id },
    });

    if (userCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "এই দপ্তরের সাথে কর্মকর্তা অ্যাকাউন্ট যুক্ত রয়েছে। প্রথমে কর্মকর্তাদের দায়িত্ব পরিবর্তন করুন।",
        },
        { status: 400 }
      );
    }

    await prisma.department.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "দপ্তর সফলভাবে মুছে ফেলা হয়েছে।" });
  } catch (error: unknown) {
    console.error("Failed to delete department:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
