import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
	{ path: '/', name: 'Dashboard', component: () => import('@/pages/DashboardPage.vue') },
	{ path: '/:pathMatch(.*)*', redirect: '/' },
]

export default createRouter({ history: createWebHistory('/vms'), routes })
