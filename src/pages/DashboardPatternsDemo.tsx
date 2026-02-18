import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type BoxProps = {
  label: string;
  span?: string;
};

const Box = ({ label, span = "col-span-1 row-span-1" }: BoxProps) => (
  <div className={`rounded-md border bg-card/70 p-2 text-[10px] leading-tight ${span}`}>
    {label}
  </div>
);

const ViewportShell = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-xl border bg-background overflow-hidden">
    <div className="h-8 border-b bg-muted/50 px-3 flex items-center text-xs text-muted-foreground">Header + Role switcher</div>
    <div className="h-8 border-b bg-background px-2 flex items-center gap-2 text-[10px]">
      <Badge variant="outline" className="text-[10px]">Overview</Badge>
      <Badge variant="outline" className="text-[10px]">Products</Badge>
      <Badge variant="outline" className="text-[10px]">Media</Badge>
      <Badge variant="outline" className="text-[10px]">Contact</Badge>
      <Badge variant="outline" className="text-[10px]">FAQ</Badge>
    </div>
    <div className="h-[460px] p-2">{children}</div>
  </div>
);

const PatternA = () => (
  <ViewportShell>
    <div className="h-full grid grid-cols-4 auto-rows-[70px] gap-1">
      <Box label="Hero 2x2" span="col-span-2 row-span-2" />
      <Box label="1x1" />
      <Box label="1x1" />
      <Box label="2x1" span="col-span-2 row-span-1" />
      <Box label="1x1" />
      <Box label="1x1" />
      <Box label="Tab changes replace this full bento" span="col-span-4 row-span-2" />
    </div>
  </ViewportShell>
);

const PatternB = () => (
  <ViewportShell>
    <div className="h-full grid grid-cols-6 auto-rows-[70px] gap-1">
      <Box label="Persistent Hero 2x2" span="col-span-2 row-span-2" />
      <Box label="Persistent 2x1" span="col-span-2 row-span-1" />
      <Box label="Detail panel (tab-controlled)" span="col-span-2 row-span-4" />
      <Box label="1x1" />
      <Box label="1x1" />
      <Box label="1x1" />
      <Box label="1x1" />
      <Box label="Bento always visible" span="col-span-4 row-span-2" />
    </div>
  </ViewportShell>
);

const PatternC = () => (
  <ViewportShell>
    <div className="h-full grid grid-cols-4 auto-rows-[70px] gap-1">
      <Box label="Selected tab page bento" span="col-span-4 row-span-1" />
      <Box label="Hero 2x2" span="col-span-2 row-span-2" />
      <Box label="2x1" span="col-span-2 row-span-1" />
      <Box label="1x1" />
      <Box label="1x1" />
      <Box label="1x1" />
      <Box label="1x1" />
      <Box label="Tab switch fully swaps page" span="col-span-4 row-span-2" />
    </div>
  </ViewportShell>
);

const DashboardPatternsDemo = () => {
  return (
    <div className="min-h-screen pt-[95px] pb-24 px-4">
      <div className="max-w-6xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Dashboard Rule Visual Demo</CardTitle>
            <p className="text-sm text-muted-foreground">
              Compare the three tab + bento behaviors in a fixed viewport frame. This is a visualization sandbox.
            </p>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="b" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="a">A: Tabs swap bento</TabsTrigger>
                <TabsTrigger value="b">B: Bento + detail panel</TabsTrigger>
                <TabsTrigger value="c">C: Full tab pages</TabsTrigger>
              </TabsList>

              <TabsContent value="a" className="space-y-2">
                <p className="text-xs text-muted-foreground">Good separation, but you lose always-visible capability context on each tab switch.</p>
                <PatternA />
              </TabsContent>

              <TabsContent value="b" className="space-y-2">
                <p className="text-xs text-muted-foreground">Recommended: core bento remains visible, tabs drive focused details panel.</p>
                <PatternB />
              </TabsContent>

              <TabsContent value="c" className="space-y-2">
                <p className="text-xs text-muted-foreground">Clean per-tab pages, but highest context switching.</p>
                <PatternC />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPatternsDemo;
