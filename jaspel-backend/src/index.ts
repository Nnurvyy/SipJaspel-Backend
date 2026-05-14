import { Hono } from 'hono'
import { cors } from 'hono/cors'
import authRoutes from './routes/auth.routes'
import reportsRoutes from './routes/reports.routes'
import exportRoutes from './routes/export.routes'
import pegawaiRoutes from './routes/pegawai.routes'
import strukturRoutes from './routes/struktur.routes'
import kehadiranRoutes from './routes/kehadiran.routes'
import unitKinerjaRoutes from './routes/unit-kinerja.routes'
import bobotStaffRoutes from './routes/bobot-staff.routes'
import paguUnitRoutes from './routes/pagu-unit.routes'
import keuanganDetailRoutes from './routes/keuangan-detail.routes'
import jaspelDistribusiRoutes from './routes/jaspel-distribusi.routes'
import tcmStaffRoutes from './routes/tcm-staff.routes'
import { Bindings } from './utils/types'

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', cors())

app.route('/api/auth', authRoutes)
app.route('/api/reports', reportsRoutes)
app.route('/api/pegawai', pegawaiRoutes)
app.route('/api/struktur', strukturRoutes)
app.route('/api/kehadiran', kehadiranRoutes)
app.route('/api/unit-kinerja', unitKinerjaRoutes)
app.route('/api/bobot-staff', bobotStaffRoutes)
app.route('/api/pagu-unit', paguUnitRoutes)
app.route('/api/keuangan-detail', keuanganDetailRoutes)
app.route('/api/jaspel-distribusi', jaspelDistribusiRoutes)
app.route('/api/tcm-staff', tcmStaffRoutes)
app.route('/api/export', exportRoutes)

app.get('/', (c) => {
  return c.text('Jaspel Backend is Running!')
})

export default app
