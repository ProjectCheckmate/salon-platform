import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { prisma } from "@/lib/db/prisma";
import { notFound, redirect } from "next/navigation";

function rupees(cents: number) {
  return `₹${(cents / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export default async function InvoicePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(`/login?next=/account/invoices/${params.id}`);
  const userId = (session.user as any).id as string;

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { items: true, salon: true, appointment: { include: { customer: true } } },
  });

  // A customer may only ever see their OWN invoice — never another
  // customer's, even if they guess a valid invoice id.
  if (!invoice || invoice.appointment.customer.userId !== userId) notFound();

  return (
    <main className="mx-auto max-w-md px-6 py-8">
      <div className="rounded-2xl border border-neutral-200 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-semibold">{invoice.salon.name}</h1>
            <p className="text-sm text-neutral-500">{invoice.invoiceNumber}</p>
          </div>
          <p className="text-sm text-neutral-500">
            {new Date(invoice.issuedAt).toLocaleDateString()}
          </p>
        </div>

        <ul className="my-4 space-y-1.5 border-y border-neutral-100 py-4">
          {invoice.items.map((item) => (
            <li key={item.id} className="flex justify-between text-sm">
              <span>{item.description}</span>
              <span>{rupees(item.amountCents)}</span>
            </li>
          ))}
        </ul>

        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-neutral-500">Subtotal</span>
            <span>{rupees(invoice.subtotalCents)}</span>
          </div>
          {invoice.discountCents > 0 && (
            <div className="flex justify-between text-green-700">
              <span>Discount</span>
              <span>-{rupees(invoice.discountCents)}</span>
            </div>
          )}
          {invoice.taxCents > 0 && (
            <div className="flex justify-between">
              <span className="text-neutral-500">Tax</span>
              <span>{rupees(invoice.taxCents)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-neutral-100 pt-1.5 font-semibold">
            <span>Total</span>
            <span>{rupees(invoice.totalCents)}</span>
          </div>
          <div className="flex justify-between text-neutral-500">
            <span>Paid</span>
            <span>{rupees(invoice.paidCents)}</span>
          </div>
          {invoice.dueCents > 0 && (
            <div className="flex justify-between font-medium text-red-600">
              <span>Due</span>
              <span>{rupees(invoice.dueCents)}</span>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
