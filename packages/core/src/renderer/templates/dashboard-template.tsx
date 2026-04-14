"use client";

import { Activity, ArrowUpRight, CircleUser, CreditCard, DollarSign, Package2, Search, Users } from "lucide-react";
import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/shadcn-ui/avatar";
import { Button } from "@/components/shadcn-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shadcn-ui/card";
import { Input } from "@/components/shadcn-ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn-ui/table";

export function DashboardTemplate() {
  return (
    <div className="flex min-h-screen w-full flex-col">
      {/* 🎯 목적: 네비게이션 헤더 - 브랜드 로고, 메뉴, 검색, 사용자 프로필 */}
      <header className="bg-background flex items-center justify-between border-b px-6 py-4">
        <nav className="flex items-center gap-6">
          {/* 브랜드 로고 영역 */}
          <div className="flex items-center gap-2">
            <Package2 className="text-foreground h-6 w-6" />
          </div>
          {/* 네비게이션 메뉴 */}
          <div className="flex items-center gap-6">
            <span className="text-foreground text-sm font-medium">Dashboard</span>
            <span className="text-muted-foreground text-sm">Orders</span>
            <span className="text-muted-foreground text-sm">Products</span>
            <span className="text-muted-foreground text-sm">Customers</span>
            <span className="text-muted-foreground text-sm">Analytics</span>
          </div>
        </nav>
        {/* 우측 유틸리티 영역 */}
        <div className="flex items-center gap-4">
          {/* 검색 입력창 */}
          <div className="relative w-80">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input placeholder="Search..." className="pl-10" />
          </div>
          {/* 사용자 프로필 버튼 */}
          <Button variant="ghost" size="icon" className="bg-muted rounded-full">
            <CircleUser className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* 🎯 목적: 메인 콘텐츠 영역 - 대시보드 통계 및 데이터 */}
      <main className="bg-background flex-1 space-y-8 p-8">
        {/* 🎯 목적: 통계 카드 그리드 - 수익, 구독, 판매, 활성 사용자 현황 */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* 총 수익 카드 */}
          <Card className="border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-foreground text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-foreground text-2xl font-bold">$2,131.86</div>
              <p className="text-muted-foreground text-xs">+20% from last month</p>
            </CardContent>
          </Card>

          {/* 구독 카드 */}
          <Card className="border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-foreground text-sm font-medium">Subscriptions</CardTitle>
              <Users className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-foreground text-2xl font-bold">$7,411.30</div>
              <p className="text-muted-foreground text-xs">+10% from last month</p>
            </CardContent>
          </Card>

          {/* 판매 카드 */}
          <Card className="border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-foreground text-sm font-medium">Sales</CardTitle>
              <CreditCard className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-foreground text-2xl font-bold">$9,896.66</div>
              <p className="text-muted-foreground text-xs">+19% from last month</p>
            </CardContent>
          </Card>

          {/* 활성 사용자 카드 */}
          <Card className="border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-foreground text-sm font-medium">Active Now</CardTitle>
              <Activity className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-foreground text-2xl font-bold">$7,940.85</div>
              <p className="text-muted-foreground text-xs">+201 since last hour</p>
            </CardContent>
          </Card>
        </div>

        {/* 🎯 목적: 콘텐츠 그리드 - 트랜잭션 테이블과 최근 판매 */}
        <div className="grid gap-8 lg:grid-cols-7">
          {/* 트랜잭션 테이블 */}
          <Card className="col-span-4 border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
              <div className="space-y-1">
                <CardTitle className="text-foreground text-xl font-semibold">Transactions</CardTitle>
                <p className="text-muted-foreground text-sm">Recent transactions from your store.</p>
              </div>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                View All
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-foreground text-sm font-medium">Customer</TableHead>
                    <TableHead className="text-foreground text-right text-sm font-medium">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* 거래 데이터 행들 */}
                  <TableRow>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="text-foreground text-sm font-medium">Alex Buckmaster</p>
                        <p className="text-muted-foreground text-sm">alex_b@gmail.com</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-foreground text-right text-sm">$4,024.92</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="text-foreground text-sm font-medium">Kathy Pacheco</p>
                        <p className="text-muted-foreground text-sm">kathy_pac@gmail.com</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-foreground text-right text-sm">$9,952.52</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="text-foreground text-sm font-medium">Lorri Warf</p>
                        <p className="text-muted-foreground text-sm">lorri@aol.com</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-foreground text-right text-sm">$3,153.64</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="text-foreground text-sm font-medium">James Hall</p>
                        <p className="text-muted-foreground text-sm">hall45@outlook.com</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-foreground text-right text-sm">$7,369.55</TableCell>
                  </TableRow>
                  <TableRow className="border-b-0">
                    <TableCell>
                      <div className="space-y-1">
                        <p className="text-foreground text-sm font-medium">Chris Glasser</p>
                        <p className="text-muted-foreground text-sm">chris_glass@aol.com</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-foreground text-right text-sm">$2,192.86</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* 최근 판매 */}
          <Card className="col-span-3 border">
            <CardHeader>
              <CardTitle className="text-foreground text-xl font-semibold">Recent Sales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="flex items-center space-x-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src="data:image/png;base64,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" />
                  <AvatarFallback>SN</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <p className="text-foreground text-sm font-medium">Stephanie Nicol</p>
                  <p className="text-muted-foreground text-sm">steph56@gmail.com</p>
                </div>
                <div className="text-foreground text-base font-medium">$4,791.80</div>
              </div>
              <div className="flex items-center space-x-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src="data:image/png;base64,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" />
                  <AvatarFallback>JD</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <p className="text-foreground text-sm font-medium">John Dukes</p>
                  <p className="text-muted-foreground text-sm">johnd@gmail.com</p>
                </div>
                <div className="text-foreground text-base font-medium">$9,336.08</div>
              </div>
              <div className="flex items-center space-x-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src="data:image/png;base64,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" />
                  <AvatarFallback>JR</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <p className="text-foreground text-sm font-medium">Judith Rodriguez</p>
                  <p className="text-muted-foreground text-sm">judith@gmail.com</p>
                </div>
                <div className="text-foreground text-base font-medium">$8,338.52</div>
              </div>
              <div className="flex items-center space-x-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src="data:image/png;base64,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" />
                  <AvatarFallback>RS</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <p className="text-foreground text-sm font-medium">Rodger Struck</p>
                  <p className="text-muted-foreground text-sm">roger@gmail.com</p>
                </div>
                <div className="text-foreground text-base font-medium">$741.28</div>
              </div>
              <div className="flex items-center space-x-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src="data:image/png;base64,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" />
                  <AvatarFallback>AB</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <p className="text-foreground text-sm font-medium">Alex Buckmaster</p>
                  <p className="text-muted-foreground text-sm">alexb23@gmail.com</p>
                </div>
                <div className="text-foreground text-base font-medium">$1,629.88</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
