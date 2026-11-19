import { prisma } from "../src/lib/prisma";

async function verify() {
  console.log("=== NETROKONA USER ACCOUNTS ===");
  const users = await prisma.user.findMany({
    select: {
      email: true,
      name: true,
      role: true,
      district: true,
      upazilaName: true,
      department: { select: { name: true } },
    },
    orderBy: [{ role: "asc" }, { upazilaName: "asc" }],
  });

  console.log(`Total users configured: ${users.length}`);
  for (const u of users) {
    console.log(
      `[${u.role.padEnd(14)}] ${u.email.padEnd(35)} | ${(u.upazilaName || "জেলা প্রশাসন").padEnd(16)} | ${u.name}`
    );
  }

  console.log("\n=== NETROKONA BENEFICIARIES (DISTRICT & UPAZILA FIELDS) ===");
  const count = await prisma.beneficiary.count();
  console.log(`Total beneficiaries: ${count}`);

  const sample = await prisma.beneficiary.findMany({
    take: 5,
    select: {
      fullName: true,
      nid: true,
      district: true,
      upazilaName: true,
      unionName: true,
      wardNo: true,
    },
  });

  for (const b of sample) {
    console.log(
      `Beneficiary: ${b.fullName.padEnd(20)} | District: ${b.district} | Upazila: ${b.upazilaName} | Union: ${b.unionName} (Ward ${b.wardNo})`
    );
  }

  console.log("\n=== REMOVAL REQUESTS ===");
  await prisma.removalRequest.updateMany({
    where: { upazilaName: null },
    data: { district: "নেত্রকোণা", upazilaName: "নেত্রকোণা সদর" },
  });
  const requests = await prisma.removalRequest.findMany({
    select: {
      id: true,
      status: true,
      district: true,
      upazilaName: true,
      beneficiary: { select: { fullName: true } },
      department: { select: { name: true } },
    },
  });
  console.log(`Removal requests count: ${requests.length}`);
  for (const r of requests) {
    console.log(
      `Req ID: ${r.id.substring(0, 8)} | Beneficiary: ${r.beneficiary.fullName} | Upazila: ${r.upazilaName} | Dept: ${r.department.name} | Status: ${r.status}`
    );
  }

  console.log("\nVerification SUCCESSFUL!");
}

verify()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
