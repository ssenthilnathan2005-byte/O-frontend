import { Sparkles } from "lucide-react";
import { useRouter } from "../../router/RouterContext";

export default function ComingSoonPage({ title }: { title: string }) {
  const { navigate } = useRouter();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-4">
      <div className="w-16 h-16 rounded-full bg-teal-50 flex items-center justify-center">
        <Sparkles className="w-8 h-8 text-teal-500" />
      </div>
      <h1 className="text-xl font-bold text-gray-900">{title}</h1>
      <p className="text-gray-500 max-w-sm">Available in the next update.</p>
      <button
        onClick={() => navigate({ path: "/patient/hospitals" })}
        className="mt-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold transition-colors"
      >
        Back to Hospitals
      </button>
    </div>
  );
}
