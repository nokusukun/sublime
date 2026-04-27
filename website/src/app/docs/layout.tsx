import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import { getNavigation } from "@/lib/content";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const navigation = getNavigation();
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex">
      <Sidebar navigation={navigation} />
      <div className="flex-1 min-w-0 py-8 lg:py-10 lg:pl-10 lg:border-l lg:border-border">
        <MobileNav navigation={navigation} />
        {children}
      </div>
    </div>
  );
}
